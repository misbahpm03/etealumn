"use server";

import { publicEnv } from "@/config/env";
import {
  createPrivilegedUserRepository,
  createRequestAuthProvider,
  getCurrentAppUser,
} from "@/infrastructure/supabase/server-session";
import { ValidationError, isAppError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { getAuthAuditLogger } from "@/services/auth/audit";
import {
  applySafeNext,
  resolvePostAuthDestination,
} from "@/services/auth";
import {
  normalizeEmail,
  validateEmailField,
  validateNewPassword,
  validateSignInInput,
} from "@/validations/auth";

/**
 * Auth server actions — the composition edge where concrete Supabase wiring
 * meets the provider-agnostic application layer (guards, routing, audit).
 * All decisions (validation, role/status routing) are server-side; results
 * carry user-safe messages only, never provider internals.
 */

export interface AuthActionSuccess {
  ok: true;
  destination?: string;
}

export interface AuthActionFailure {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string>;
}

export type AuthActionResult = AuthActionSuccess | AuthActionFailure;

function toFailure(error: unknown, fallback: string): AuthActionFailure {
  if (error instanceof ValidationError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      if (!(issue.field in fieldErrors)) {
        fieldErrors[issue.field] = issue.message;
      }
    }
    return {
      ok: false,
      error:
        error.issues.length > 0
          ? "Please fix the highlighted fields."
          : error.message,
      fieldErrors,
    };
  }
  if (isAppError(error)) {
    // AppErrors are user-safe by construction (details stay on `cause`).
    return { ok: false, error: error.message };
  }
  console.error("[auth] unexpected error", error);
  return { ok: false, error: fallback };
}

export async function signInAction(input: {
  email: string;
  password: string;
  next?: string;
}): Promise<AuthActionResult> {
  const issues = validateSignInInput(input);
  if (issues.length > 0) {
    return toFailure(new ValidationError(issues), "Sign-in failed.");
  }
  try {
    const auth = await createRequestAuthProvider();
    const session = await auth.signIn({
      email: normalizeEmail(input.email),
      password: input.password,
    });
    try {
      // System bookkeeping (privileged: users must not write their own row).
      // Best-effort — a stamp failure must never break authentication.
      await createPrivilegedUserRepository().touchLastLogin(session.user.id);
    } catch (error) {
      console.warn("[auth] touchLastLogin failed", error);
    }
    getAuthAuditLogger().log("login", { appUserId: session.user.id });
    // Destination derives from the verified app user — never client input.
    // (A distinct "setup incomplete" message here leaks nothing: it only
    // appears AFTER credentials verified, which already proved the account.)
    const destination = applySafeNext(
      resolvePostAuthDestination(session.user),
      input.next,
    );
    return { ok: true, destination };
  } catch (error) {
    return toFailure(error, "Sign-in failed. Please try again.");
  }
}

export async function signOutAction(): Promise<AuthActionResult> {
  try {
    const appUser = await getCurrentAppUser().catch(() => null);
    const auth = await createRequestAuthProvider();
    await auth.signOut();
    getAuthAuditLogger().log(
      "logout",
      appUser ? { appUserId: appUser.id } : {},
    );
    return { ok: true, destination: routes.public.signIn };
  } catch (error) {
    return toFailure(error, "Sign-out failed. Please try again.");
  }
}

export async function requestPasswordResetAction(input: {
  email: string;
}): Promise<AuthActionResult> {
  // ALWAYS succeeds publicly: neither Supabase nor this action confirms
  // whether the address belongs to an account (enumeration hygiene).
  if (validateEmailField(input.email).length === 0) {
    try {
      const auth = await createRequestAuthProvider();
      await auth.resetPassword(normalizeEmail(input.email), {
        redirectTo:
          `${publicEnv.siteUrl}${routes.auth.callback}` +
          `?next=${encodeURIComponent(routes.public.resetPassword)}`,
      });
      getAuthAuditLogger().log("password_reset_requested", {});
    } catch (error) {
      console.warn("[auth] password-reset request failed", error);
    }
  }
  return { ok: true };
}

export async function updatePasswordAction(input: {
  password: string;
}): Promise<AuthActionResult> {
  const issues = validateNewPassword(input.password);
  if (issues.length > 0) {
    return toFailure(
      new ValidationError(issues),
      "Could not update the password.",
    );
  }
  try {
    const auth = await createRequestAuthProvider();
    await auth.updatePassword(input.password);
    getAuthAuditLogger().log("password_updated", {});
    const appUser = await getCurrentAppUser().catch(() => null);
    return { ok: true, destination: resolvePostAuthDestination(appUser) };
  } catch (error) {
    return toFailure(error, "Could not update the password.");
  }
}

export async function resendVerificationEmailAction(input: {
  email: string;
}): Promise<AuthActionResult> {
  // Generic success (same enumeration reasoning as password reset).
  if (validateEmailField(input.email).length === 0) {
    try {
      const auth = await createRequestAuthProvider();
      await auth.resendVerificationEmail(normalizeEmail(input.email));
      getAuthAuditLogger().log("verification_email_resent", {});
    } catch (error) {
      console.warn("[auth] verification re-send failed", error);
    }
  }
  return { ok: true };
}
