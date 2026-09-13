import type {
  PaginatedResult,
  PaginationParams,
  SessionUser,
  UserRole,
  UserStatus,
  Uuid,
} from "@/types";

/**
 * Persistence contract for users. Implementations live in the infrastructure
 * layer (Supabase first). Application code depends only on this interface.
 *
 * Method set is intentionally small in Phase 1 and will grow with the
 * Phase 2 schema — the interface (not the provider) is the stable seam.
 */
export interface UserRepository {
  findById(id: Uuid): Promise<SessionUser | null>;
  findByEmail(email: string): Promise<SessionUser | null>;
  list(params: PaginationParams & { role?: UserRole }): Promise<PaginatedResult<SessionUser>>;
  updateStatus(id: Uuid, status: UserStatus): Promise<SessionUser>;
  updateRole(id: Uuid, role: UserRole): Promise<SessionUser>;
}
