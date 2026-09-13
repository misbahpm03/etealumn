import type { AuthSession, SignInCredentials } from "@/types";

/**
 * Authentication contract. Supabase Auth is the first implementation
 * (Phase 3); any OIDC/session provider can replace it behind this interface.
 *
 * Implementations must never expose provider tokens or secrets to callers
 * that don't need them — the session carries only the application principal.
 */
export interface AuthProvider {
  /** Current session, or null when signed out. */
  getSession(): Promise<AuthSession | null>;
  /** Authenticate with email + password. */
  signIn(credentials: SignInCredentials): Promise<AuthSession>;
  /** End the current session. */
  signOut(): Promise<void>;
}
