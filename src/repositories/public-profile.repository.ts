import type {
  SafeMemberProfile,
  SafePublicProfile,
  Uuid,
} from "@/types";

/**
 * Read-only contract over the SAFE profile projections (`profiles_public`
 * / `profiles_member` views) — the only sanctioned cross-user profile
 * reads. Privacy flags, account status, and visibility are enforced INSIDE
 * the views, so callers cannot bypass them; raw `profiles` rows are never
 * returned here. The directory UI arrives in a later phase; this is the
 * structural seam it will build on.
 */
export interface PublicProfileRepository {
  getPublicProfile(userId: Uuid): Promise<SafePublicProfile | null>;
  getMemberProfile(userId: Uuid): Promise<SafeMemberProfile | null>;
}
