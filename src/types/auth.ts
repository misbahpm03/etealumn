import type { IsoDateString } from "./common";
import type { SessionUser } from "./user";

/** Provider-agnostic authenticated session. */
export interface AuthSession {
  user: SessionUser;
  expiresAt: IsoDateString;
}

/**
 * Verified authentication identity: who the credential holder is, and
 * whether their email is confirmed. Carries NO role/status — those live in
 * `public.users` and arrive via `SessionUser`.
 */
export interface AuthIdentity {
  /** Provider subject (`auth.users.id` for Supabase). */
  authUserId: string;
  email: string | null;
  emailConfirmedAt: IsoDateString | null;
}

export interface SignInCredentials {
  email: string;
  password: string;
}
