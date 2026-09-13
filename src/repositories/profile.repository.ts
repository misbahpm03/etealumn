import type {
  ProfilePrivacy,
  UpdatePrivacyInput,
  UpdateProfileInput,
  Uuid,
} from "@/types";
import type { Profile } from "@/types";

/**
 * Persistence contracts for member profiles and privacy settings.
 * Implementations live in the infrastructure layer (Supabase first).
 *
 * Repositories take an explicit `userId` (a dumb data-access capability);
 * the SERVICE layer binds the server-resolved current user, so no browser
 * input ever chooses whose row is touched. Reads/updates run on the
 * request client (RLS enforces owner+ACTIVE); `create` runs privileged
 * (idempotent ensure must also cover PENDING users, whom RLS write-gates).
 */
export interface ProfileRepository {
  findByUserId(userId: Uuid): Promise<Profile | null>;
  create(input: { userId: Uuid; fullName: string }): Promise<Profile>;
  /** Throws NotFoundError when the caller's row is missing. */
  update(userId: Uuid, input: UpdateProfileInput): Promise<Profile>;
}

export interface ProfilePrivacyRepository {
  findByUserId(userId: Uuid): Promise<ProfilePrivacy | null>;
  create(input: { userId: Uuid }): Promise<ProfilePrivacy>;
  /** Throws NotFoundError when the caller's row is missing. */
  update(userId: Uuid, input: UpdatePrivacyInput): Promise<ProfilePrivacy>;
}
