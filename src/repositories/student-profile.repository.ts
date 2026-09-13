import type {
  CreateStudentProfileInput,
  StudentProfile,
  UpdateStudentProfileInput,
  Uuid,
} from "@/types";

/**
 * Persistence contract for student academic identity.
 *
 * RLS deliberately offers NO self-service INSERT here (and direct UPDATE is
 * grant-limited to two harmless columns): creation and verified fields go
 * through audited server-side operations. The service therefore runs this
 * repository on a privileged client, enforcing ACTIVE status, STUDENT role,
 * ownership, and batch validity in code. Direct database access stays
 * locked down regardless.
 */
export interface StudentProfileRepository {
  findByUserId(userId: Uuid): Promise<StudentProfile | null>;
  create(
    input: { userId: Uuid } & CreateStudentProfileInput,
  ): Promise<StudentProfile>;
  /** Throws NotFoundError when the caller's row is missing. */
  update(
    userId: Uuid,
    input: UpdateStudentProfileInput,
  ): Promise<StudentProfile>;
}
