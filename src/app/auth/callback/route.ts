import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { routes } from "@/lib/routes";
import { getAuthAuditLogger } from "@/services/auth/audit";
import {
  applySafeNext,
  resolvePostAuthDestination,
} from "@/services/auth";
import type { SessionUser } from "@/types";

/**
 * Server-side exchange endpoint for Supabase email links (verification,
 * password recovery, invites). Exchanges the one-time `code` (or legacy
 * `token_hash` + `type`) for a session via cookies — tokens never touch
 * localStorage or client code — then routes by the verified app user.
 *
 * Failures land on sign-in with a generic link error (no token details).
 */

const VERIFY_TYPES: ReadonlySet<string> = new Set([
  "email",
  "invite",
  "magiclink",
  "recovery",
  "signup",
]);

function signInWithError(request: NextRequest, error: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = routes.public.signIn;
  url.search = `?error=${encodeURIComponent(error)}`;
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const supabase = await createSupabaseServerClient();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return signInWithError(request, "link-expired");
    }
  } else if (tokenHash && type && VERIFY_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      // Allow-listed above; the provider accepts these OTP types.
      type: type as "email" | "invite" | "magiclink" | "recovery" | "signup",
    });
    if (error) {
      return signInWithError(request, "link-expired");
    }
  } else {
    return signInWithError(request, "link-invalid");
  }

  // Session established on this client: route by the verified app user.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let appUser: SessionUser | null = null;
  if (user) {
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
  if (appUser) {
    getAuthAuditLogger().log("login", { appUserId: appUser.id });
  }
  const destination = applySafeNext(
    resolvePostAuthDestination(appUser),
    searchParams.get("next"),
  );
  return NextResponse.redirect(new URL(destination, request.url));
}
