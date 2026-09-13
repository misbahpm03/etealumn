import type {
  Education,
  EducationInput,
  UpdateEducationInput,
  Uuid,
} from "@/types";

/**
 * Persistence contract for education entries. Same posture as work
 * experience: `userId` pinned per query, request client, RLS self-service.
 */
export interface EducationRepository {
  listByUserId(userId: Uuid): Promise<ReadonlyArray<Education>>;
  findById(id: Uuid, userId: Uuid): Promise<Education | null>;
  create(userId: Uuid, input: EducationInput): Promise<Education>;
  /** Throws NotFoundError when the id is not the caller's. */
  update(
    id: Uuid,
    userId: Uuid,
    input: UpdateEducationInput,
  ): Promise<Education>;
  /** Throws NotFoundError when the id is not the caller's. */
  remove(id: Uuid, userId: Uuid): Promise<void>;
}
