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
 * Identity note: `findById` uses the application id (`users.id`); auth flows
 * resolve via `findByAuthUserId` (`users.auth_user_id`, mirrored from
 * `auth.users.id` by the provisioning trigger — never client-chosen).
 *
 * RLS note: `authenticated` holds SELECT on `users` only (own row or admin),
 * so `updateStatus`/`updateRole`/`touchLastLogin` require a privileged
 * (service-role) repository instance — admin callers only, server-side.
 */
export interface UserRepository {
  findById(id: Uuid): Promise<SessionUser | null>;
  findByAuthUserId(authUserId: Uuid): Promise<SessionUser | null>;
  findByEmail(email: string): Promise<SessionUser | null>;
  list(params: PaginationParams & { role?: UserRole }): Promise<PaginatedResult<SessionUser>>;
  updateStatus(id: Uuid, status: UserStatus): Promise<SessionUser>;
  updateRole(id: Uuid, role: UserRole): Promise<SessionUser>;
  /**
   * System bookkeeping: stamp `last_login_at`. Called by the login flow
   * with a privileged client — ordinary users must not write `users`.
   */
  touchLastLogin(id: Uuid): Promise<void>;
}
