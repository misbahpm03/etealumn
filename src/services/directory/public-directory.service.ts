import { STORAGE_BUCKETS } from "@/config/storage";
import { ValidationError } from "@/lib/errors";
import type {
  ProfileRepository,
  PublicProfileRepository,
} from "@/repositories";
import type { MediaStorageService } from "@/services/storage";
import type {
  DirectorySearchInput,
  DirectorySearchResult,
  PublicProfileDetail,
  SafePublicProfile,
} from "@/types";
import {
  validateDirectorySearch,
  validateSlug,
} from "@/validations/directory";

/**
 * Wiring for the public directory. The request-client `directory` repo reads
 * ONLY the privacy-enforcing views (safe for signed-out callers — the views
 * decide eligibility). The privileged repo exists for ONE seam: resolving a
 * photo path AFTER a public-view hit (paths are withheld from the views so
 * anonymous clients cannot harvest user IDs embedded in them).
 */
export interface PublicDirectoryDeps {
  directory: PublicProfileRepository;
  profilesPrivileged: ProfileRepository;
  photos: MediaStorageService;
}

/**
 * Sentinel requester for anonymous photo signing. The storage service only
 * compares it for the owner fast-path; cross-user access is granted by the
 * explicit `isVisibleToRequester` decision below (view hit + hasPhoto).
 */
const ANONYMOUS_REQUESTER_ID = "00000000-0000-0000-0000-000000000000";

/** Short-lived photo URLs: privacy flips must take effect within minutes. */
const PHOTO_URL_TTL_SECONDS = 300;

/**
 * Anonymous-safe public directory reads. Every method validates input,
 * queries ONLY the safe projections, and returns DTOs (never raw rows).
 * No requester checks exist here by design: anything returned is public by
 * construction of the views.
 */
export class PublicDirectoryService {
  constructor(private readonly deps: PublicDirectoryDeps) {}

  /**
   * Paged public search. All filtering happens in the database on
   * `profiles_public`; hidden/inactive rows never leave Postgres.
   */
  async searchPublicProfiles(
    input: DirectorySearchInput,
  ): Promise<DirectorySearchResult> {
    const { query, issues } = validateDirectorySearch(input);
    if (issues.length > 0) throw new ValidationError(issues);
    const { rows, total } = await this.deps.directory.searchPublicProfiles(query);
    const page = Math.floor(query.offset / query.limit) + 1;
    return {
      rows,
      total,
      page,
      pageSize: query.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    };
  }

  /** Public profile card data by slug (null when absent/hidden/ineligible). */
  async getPublicProfileBySlug(slug: string): Promise<SafePublicProfile | null> {
    throwIfIssues(validateSlug(slug));
    return this.deps.directory.getPublicProfileBySlug(slug);
  }

  /**
   * Full public profile for the detail page: projection + flag-gated
   * career/education lists. Null unless the profile itself is public —
   * career/education views re-check eligibility independently, so a list
   * can never leak for a hidden profile even if queried directly.
   */
  async getPublicProfileDetail(slug: string): Promise<PublicProfileDetail | null> {
    throwIfIssues(validateSlug(slug));
    const profile = await this.deps.directory.getPublicProfileBySlug(slug);
    if (!profile) return null;
    const [work, education] = await Promise.all([
      this.deps.directory.listPublicWorkExperience(slug),
      this.deps.directory.listPublicEducation(slug),
    ]);
    return { ...profile, work, education };
  }

  /**
   * Short-lived photo access for a PUBLIC profile. Returns null unless the
   * view confirms eligibility AND a photo exists. The returned shape
   * carries ONLY the signed URL + expiry — never the storage path (which
   * embeds the owner's user ID) or any identifier.
   */
  async getProfilePhotoAccess(
    slug: string,
  ): Promise<{ url: string; expiresAt: string } | null> {
    throwIfIssues(validateSlug(slug));
    // Eligibility authority: the public view. No hit ⇒ no photo, no oracle
    // beyond what the public profile page itself reveals (same null).
    const profile = await this.deps.directory.getPublicProfileBySlug(slug);
    if (!profile || !profile.hasPhoto) return null;
    const privileged = await this.deps.profilesPrivileged.findBySlug(slug);
    const path = privileged?.profilePhotoPath;
    if (!privileged || !path) return null;
    const access = await this.deps.photos.getProfileMediaAccess({
      bucket: STORAGE_BUCKETS.PROFILE_MEDIA,
      path,
      ownerId: privileged.userId,
      requesterId: ANONYMOUS_REQUESTER_ID,
      isVisibleToRequester: true,
      expiresInSeconds: PHOTO_URL_TTL_SECONDS,
    });
    return { url: access.url, expiresAt: access.expiresAt };
  }
}

function throwIfIssues(
  issues: ReadonlyArray<{ field: string; message: string }>,
): void {
  if (issues.length > 0) {
    throw new ValidationError(issues);
  }
}
