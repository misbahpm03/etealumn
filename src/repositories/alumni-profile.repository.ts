import type {
  AlumniProfile,
  AlumniProfileInput,
  Uuid,
} from "@/types";

/**
 * Persistence contract for alumni academic identity.
 *
 * Same posture as student profiles: no self-service INSERT in RLS, so the
 * service runs this repository privileged and enforces ACTIVE status,
 * ALUMNI role, ownership, and batch validity in code (audited).
 */
export interface AlumniProfileRepository {
  findByUserId(userId: Uuid): Promise<AlumniProfile | null>;
  create(
    input: { userId: Uuid } & AlumniProfileInput,
  ): Promise<AlumniProfile>;
  /** Throws NotFoundError when the caller's row is missing. */
  update(userId: Uuid, input: AlumniProfileInput): Promise<AlumniProfile>;
}
