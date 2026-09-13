import { ValidationError } from "@/lib/errors";
import type { PublicProfileRepository } from "@/repositories";
import { assertActiveUser } from "@/services/auth/guards";
import type {
  SafeMemberProfile,
  SafePublicProfile,
  SessionUser,
  Uuid,
} from "@/types";
import { validateSlug } from "@/validations/directory";
import { validateRecordId } from "@/validations/profile";

/**
 * Server-side seam for SAFE cross-user profile reads — the abstraction the
 * future directory builds on (no directory UI in this phase).
 *
 * Both methods read ONLY the privacy-enforcing views (`profiles_public` /
 * `profiles_member`): field-level flags, account status, and visibility are
 * applied inside the database, so callers structurally cannot bypass them.
 * Raw `profiles` rows are never returned here.
 */
export class DirectoryProfileService {
  constructor(private readonly directory: PublicProfileRepository) {}

  /**
   * Public listing projection, keyed by slug (Phase 8: user_id no longer
   * exists on the public view). The view itself restricts rows to ACTIVE +
   * opted-in + PUBLIC; no requester check needed (anonymous-safe content).
   */
  async getPublicProfileBySlug(slug: string): Promise<SafePublicProfile | null> {
    const issues = validateSlug(slug);
    if (issues.length > 0) throw new ValidationError(issues);
    return this.directory.getPublicProfileBySlug(slug);
  }

  /**
   * Member directory projection. The requester must be an ACTIVE member
   * (member directory is an active-member capability); the view then
   * applies per-row visibility + per-field flags for the caller's role.
   */
  async getMemberProfile(
    requester: SessionUser,
    userId: Uuid,
  ): Promise<SafeMemberProfile | null> {
    assertActiveUser(requester);
    const issues = validateRecordId(userId);
    if (issues.length > 0) throw new ValidationError(issues);
    return this.directory.getMemberProfile(userId);
  }
}
