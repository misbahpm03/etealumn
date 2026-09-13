import type {
  DirectorySearchQuery,
  PublicEducationItem,
  PublicWorkItem,
  SafeMemberProfile,
  SafePublicProfile,
  Uuid,
} from "@/types";

/**
 * Read-only contract over the SAFE profile projections — the only
 * sanctioned cross-user profile reads. Privacy flags, account status, role
 * eligibility, and visibility are enforced INSIDE the database views, so
 * callers cannot bypass them; raw `profiles` / `alumni_profiles` rows are
 * never returned here.
 *
 * Public reads are keyed by SLUG (never user_id): anonymous clients must
 * not harvest raw user IDs. Search filters apply inside the database query
 * (fetch-then-filter in JS is forbidden — it would be both a leak and a
 * performance cliff).
 */
export interface PublicProfileRepository {
  /**
   * Public projection row by slug, or null when absent, hidden, or
   * ineligible (the view decides — the caller cannot distinguish why).
   */
  getPublicProfileBySlug(slug: string): Promise<SafePublicProfile | null>;

  /**
   * Paged, database-filtered public search. `total` counts
   * visibility-eligible rows only, so pagination cannot leak hidden rows.
   */
  searchPublicProfiles(
    query: DirectorySearchQuery,
  ): Promise<{ rows: SafePublicProfile[]; total: number }>;

  /**
   * Flag-gated public career list (empty when the owner opted out via
   * show_career or is publicly ineligible — never an error).
   */
  listPublicWorkExperience(slug: string): Promise<ReadonlyArray<PublicWorkItem>>;

  /**
   * Flag-gated public education list (empty when opted out / ineligible).
   */
  listPublicEducation(slug: string): Promise<ReadonlyArray<PublicEducationItem>>;

  /** Member projection (authenticated-only view) — Phase 7 seam, unchanged. */
  getMemberProfile(userId: Uuid): Promise<SafeMemberProfile | null>;
}
