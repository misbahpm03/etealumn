import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "@/infrastructure/supabase/middleware-client";
import { ServiceNotConfiguredError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import {
  applySafeNext,
  resolvePostAuthDestination,
} from "@/services/auth";
import type { SessionUser } from "@/types";

/**
 * Request proxy (Next 16 file convention; previously "middleware").
 * Coarse auth routing: session refresh + shell-level redirects.
 *
 * - Signed-out requests to /portal/* or /admin/* bounce to sign-in (with
 *   a same-shell `next` for the return trip).
 * - Signed-in requests are routed by the SHARED `resolvePostAuthDestination`
 *   table (verification → status → role shell). Auth pages self-heal to the
 *   destination; shell requests outside the resolved shell bounce to it.
 *
 * This is coarse routing, not authorization: layouts re-verify with the
 * server session, and RLS guards every database operation. When Supabase is
 * not configured (local UI work), the proxy degrades to pass-through
 * and the same guards degrade in the layouts.
 */

/** Pages whose only job is routing the visitor somewhere else. */
const AUTH_ROUTING_PATHS: ReadonlySet<string> = new Set([
  routes.public.signIn,
  routes.public.forgotPassword,
  routes.public.accountStatus,
  routes.public.verifyEmail,
]);

/**
 * Session-gated public pages: meaningless without a session, so signed-out
 * visitors get a hard redirect here (a real 307 — page-level guards would
 * only fire mid-stream, after the shell has already flushed).
 */
const SESSION_GATED_PATHS: ReadonlySet<string> = new Set([
  routes.public.accountStatus,
  routes.public.resetPassword,
]);

function isShellPath(pathname: string, shell: string): boolean {
  return pathname === shell || pathname.startsWith(`${shell}/`);
}

function redirectTo(request: NextRequest, target: string): NextResponse {
  return NextResponse.redirect(new URL(target, request.url));
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, searchParams } = request.nextUrl;

  let supabase;
  let response: NextResponse;
  try {
    ({ supabase, response } = createSupabaseMiddlewareClient(request));
  } catch (error) {
    if (error instanceof ServiceNotConfiguredError) {
      return NextResponse.next({ request });
    }
    throw error;
  }

  // Verifies (and refreshes) the session; null when signed out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isShellPath(pathname, "/portal") || isShellPath(pathname, "/admin")) {
      const url = request.nextUrl.clone();
      url.pathname = routes.public.signIn;
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    if (SESSION_GATED_PATHS.has(pathname)) {
      return redirectTo(request, routes.public.signIn);
    }
    return response;
  }

  // Authenticated: coarse routing needs the app row — but only on pages
  // that route (shells + auth pages). Recovery/password pages pass through.
  const needsAppUser =
    isShellPath(pathname, "/portal") ||
    isShellPath(pathname, "/admin") ||
    AUTH_ROUTING_PATHS.has(pathname);
  let appUser: SessionUser | null = null;
  if (needsAppUser) {
    const { data } = await supabase
      .from("users")
      .select("id,email,role,status")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    appUser = data
      ? {
          id: data.id,
          email: data.email,
          role: data.role,
          status: data.status,
          emailVerifiedAt: user.email_confirmed_at ?? null,
        }
      : null;
  }
  const destination = resolvePostAuthDestination(appUser);

  // Shell consistency: requests outside the resolved shell bounce to it.
  if (
    isShellPath(pathname, "/portal") &&
    !isShellPath(destination, "/portal")
  ) {
    return redirectTo(request, destination);
  }
  if (isShellPath(pathname, "/admin") && !isShellPath(destination, "/admin")) {
    return redirectTo(request, destination);
  }

  // Auth pages self-heal (signed-in visitors don't linger on sign-in;
  // ACTIVE users don't linger on status pages).
  if (AUTH_ROUTING_PATHS.has(pathname) && pathname !== destination) {
    const target =
      pathname === routes.public.signIn
        ? applySafeNext(destination, searchParams.get("next"))
        : destination;
    if (target !== pathname) {
      return redirectTo(request, target);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/portal/:path*",
    "/admin/:path*",
    "/signin",
    "/forgot-password",
    "/reset-password",
    "/account-status",
    "/verify-email",
  ],
};
