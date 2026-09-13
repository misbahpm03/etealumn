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
 * Authenticated application principal: Supabase Auth proves identity;
 * `public.users` supplies role + status (never the JWT, never the browser).
 * `id` is the application user id (`public.users.id`), NOT the Supabase
 * `auth.users` id — the two are linked by `users.auth_user_id`.
 * `emailVerifiedAt` comes from the Supabase user (`email_confirmed_at`);
 * the application keeps no separate verification flag.
 */
export interface SessionUser {
  id: Uuid;
  email: string;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: IsoDateString | null;
}
