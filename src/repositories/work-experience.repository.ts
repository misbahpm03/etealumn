import type {
  UpdateWorkExperienceInput,
  Uuid,
  WorkExperience,
  WorkExperienceInput,
} from "@/types";

/**
 * Persistence contract for work-experience entries.
 *
 * Every method pins `userId` in the query itself (defense in depth WITH the
 * RLS policy, which independently requires owner-or-admin). Runs on the
 * request client: owner CRUD is a deliberate RLS self-service grant.
 */
export interface WorkExperienceRepository {
  listByUserId(userId: Uuid): Promise<ReadonlyArray<WorkExperience>>;
  findById(id: Uuid, userId: Uuid): Promise<WorkExperience | null>;
  create(userId: Uuid, input: WorkExperienceInput): Promise<WorkExperience>;
  /** Throws NotFoundError when the id is not the caller's. */
  update(
    id: Uuid,
    userId: Uuid,
    input: UpdateWorkExperienceInput,
  ): Promise<WorkExperience>;
  /** Throws NotFoundError when the id is not the caller's. */
  remove(id: Uuid, userId: Uuid): Promise<void>;
}
