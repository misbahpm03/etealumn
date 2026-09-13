import type { AuthSession, SessionUser, SignInCredentials } from "@/types";

/**
 * Authentication contract. Supabase Auth is the first implementation
 * (see `src/infrastructure/supabase/supabase-auth.provider.ts`); any
 * OIDC/session provider can replace it behind this interface.
 *
 * Implementations must never expose provider tokens or secrets to callers
 * that don't need them — the session carries only the application principal.
 */
export interface AuthProvider {
  /** Currently authenticated principal, or null when signed out. */
  getCurrentUser(): Promise<SessionUser | null>;
  /** Current session, or null when signed out. */
  getSession(): Promise<AuthSession | null>;
  /** Authenticate with email + password. */
  signIn(credentials: SignInCredentials): Promise<AuthSession>;
  /** End the current session. */
  signOut(): Promise<void>;
  /** Refresh the session; null when it cannot be refreshed. */
  refreshSession(): Promise<AuthSession | null>;
  /** Send a password-reset email. Must not reveal if the email exists. */
  resetPassword(email: string): Promise<void>;
  /** Update the signed-in user's password. */
  updatePassword(newPassword: string): Promise<void>;
}
