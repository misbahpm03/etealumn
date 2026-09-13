import {
  DeactivatedAccountError,
  ForbiddenError,
  MissingAppUserError,
  PendingAccountError,
  SuspendedAccountError,
  UnauthorizedError,
} from "@/lib/errors";
import type { AuthIdentity, SessionUser, UserRole } from "@/types";

/**
 * Pure application-layer guards. They take an ALREADY-LOADED principal
 * (fetched server-side through RLS) and narrow it — no I/O here, so these
 * are trivially testable and safe to share.
 *
 * Convention (mirrors the RLS helpers): EVERY role assertion implies
 * `status = 'ACTIVE'`. There is no "role privilege" while PENDING,
 * SUSPENDED, or DEACTIVATED.
 *
 * These guards are convenience checks at the application layer. They do NOT
 * replace RLS — the database remains the final authorization layer.
 */

/** Signed in at all (Supabase identity verified). */
export function assertAuthenticated(
  identity: AuthIdentity | null,
): asserts identity is AuthIdentity {
  if (!identity) {
    throw new UnauthorizedError();
  }
}

/** Identity has a provisioned `public.users` row (any status). */
export function assertAppUser(
  appUser: SessionUser | null,
): asserts appUser is SessionUser {
  if (!appUser) {
    throw new MissingAppUserError();
  }
}

/** Provisioned AND status ACTIVE. */
export function assertActiveUser(
  appUser: SessionUser | null,
): asserts appUser is SessionUser {
  assertAppUser(appUser);
  switch (appUser.status) {
    case "ACTIVE":
      return;
    case "PENDING":
      throw new PendingAccountError();
    case "SUSPENDED":
      throw new SuspendedAccountError();
    case "DEACTIVATED":
      throw new DeactivatedAccountError();
  }
}

/** Active AND exactly this role. */
export function assertRole(
  appUser: SessionUser | null,
  role: UserRole,
): asserts appUser is SessionUser {
  assertActiveUser(appUser);
  if (appUser.role !== role) {
    throw new ForbiddenError("This area requires a different account role.");
  }
}

/** Active AND one of these roles. */
export function assertAnyRole(
  appUser: SessionUser | null,
  roles: ReadonlyArray<UserRole>,
): asserts appUser is SessionUser {
  assertActiveUser(appUser);
  if (!roles.includes(appUser.role)) {
    throw new ForbiddenError("This area requires a different account role.");
  }
}
