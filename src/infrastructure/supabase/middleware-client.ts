import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabasePublicConfig } from "@/config/env";

/**
 * Proxy-safe Supabase client factory (anon key + request cookies).
 *
 * Deliberately separate from `server.ts`: the request proxy cannot use
 * `next/headers` or `server-only` (it runs outside the React Server
 * Components runtime), so cookie get/set is wired to the request/response
 * pair directly. Session refresh happens implicitly via `getUser()`.
 */
export function createSupabaseMiddlewareClient(request: NextRequest) {
  const { url, anonKey } = getSupabasePublicConfig();
  const response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });
  return { supabase, response };
}
