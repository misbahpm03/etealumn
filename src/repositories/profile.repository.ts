import type { Uuid } from "@/types";

/**
 * Minimal profile shape for Phase 1. The full profile + privacy model
 * (profile_privacy, work_experience, education, …) arrives with Phase 2.
 */
export interface Profile {
  id: Uuid;
  userId: Uuid;
  fullName: string;
  headline: string | null;
  avatarPath: string | null;
}

export interface UpdateProfileInput {
  fullName?: string;
  headline?: string | null;
  avatarPath?: string | null;
}

/** Persistence contract for member profiles. */
export interface ProfileRepository {
  findByUserId(userId: Uuid): Promise<Profile | null>;
  update(userId: Uuid, input: UpdateProfileInput): Promise<Profile>;
}
