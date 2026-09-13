import type {
  SupabaseClient,
  User as SupabaseUser,
} from "@supabase/supabase-js";
import { ServiceNotConfiguredError } from "@/lib/errors";
import type { AuthProvider } from "@/providers/auth.provider";
import type { AuthSession, SessionUser, SignInCredentials } from "@/types";
import { toAppError } from "./errors";

/**
 * Resolves a Supabase auth user id to the application principal (role +
 * status live in our own `users` table, not in Supabase Auth). Wired from
 * the UserRepository in Phase 3; until then, role-bearing methods throw
 * `ServiceNotConfiguredError` instead of fabricating roles.
 */
export type SessionUserResolver = (
  supabaseUserId: string,
) => Promise<SessionUser>;

/**
 * Supabase Auth implementation of `AuthProvider`. Receives its client via
 * constructor injection so server code passes the request-scoped client
 * (cookie-bound, RLS-aware) and browser code passes the browser client.
 */
export class SupabaseAuthProvider implements AuthProvider {
  constructor(
    private readonly client: SupabaseClient,
    private readonly resolveSessionUser?: SessionUserResolver,
  ) {}

  async getCurrentUser(): Promise<SessionUser | null> {
    const { data, error } = await this.client.auth.getUser();
    if (error) {
      throw toAppError(error, "Could not load the signed-in user.");
    }
    if (!data.user) {
      return null;
    }
    return this.toSessionUser(data.user);
  }

  async getSession(): Promise<AuthSession | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) {
      throw toAppError(error, "Could not load the session.");
    }
    const session = data.session;
    if (!session?.user) {
      return null;
    }
    const expiresAtSeconds =
      session.expires_at ?? Math.floor(Date.now() / 1000);
    return {
      user: await this.toSessionUser(session.user),
      expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
    };
  }

  async signIn(credentials: SignInCredentials): Promise<AuthSession> {
    const { error } = await this.client.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });
    if (error) {
      throw toAppError(error, "Sign-in failed. Please try again.");
    }
    const session = await this.getSession();
    if (!session) {
      throw toAppError(
        { code: "session_missing_after_sign_in" },
        "Sign-in succeeded but no session was established.",
      );
    }
    return session;
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw toAppError(error, "Sign-out failed. Please try again.");
    }
  }

  async refreshSession(): Promise<AuthSession | null> {
    const { data, error } = await this.client.auth.refreshSession();
    if (error) {
      throw toAppError(error, "Could not refresh the session.");
    }
    if (!data.session) {
      return null;
    }
    return this.getSession();
  }

  async resetPassword(email: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email);
    if (error) {
      throw toAppError(
        error,
        "Could not send the password-reset email. Please try again.",
      );
    }
  }

  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({
      password: newPassword,
    });
    if (error) {
      throw toAppError(error, "Could not update the password.");
    }
  }

  private async toSessionUser(user: SupabaseUser): Promise<SessionUser> {
    if (!this.resolveSessionUser) {
      throw new ServiceNotConfiguredError(
        "Session user resolution (wired from the users table in Phase 3)",
      );
    }
    return this.resolveSessionUser(user.id);
  }
}
