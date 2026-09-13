import type { IsoDateString, Uuid } from "./common";

/**
 * User roles. Enforced server-side and via PostgreSQL RLS — never by UI
 * checks alone.
 */
export const USER_ROLES = {
  STUDENT: "STUDENT",
  ALUMNI: "ALUMNI",
  FACULTY: "FACULTY",
  MODERATOR: "MODERATOR",
  ADMIN: "ADMIN",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

/** Account lifecycle status. */
export const USER_STATUSES = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  DEACTIVATED: "DEACTIVATED",
} as const;

export type UserStatus = (typeof USER_STATUSES)[keyof typeof USER_STATUSES];

/**
 * Minimal authenticated principal used across the application layer.
 * (Full user/profile entities arrive with the Phase 2 schema.)
 */
export interface SessionUser {
  id: Uuid;
  email: string;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: IsoDateString | null;
}
