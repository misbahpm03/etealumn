import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "@/config/env";

/**
 * Server-side Supabase client (anon key + request cookies — RLS applies per
 * the signed-in user). Usable from Server Components, Server Actions, and
 * Route Handlers. Never import from client components: the `server-only`
 * import above fails the build if that happens.
 *
 * Session refresh in middleware/proxy lands with the auth phase; until then
 * this factory only establishes correctly-scoped client creation.
 */
export async function createSupabaseServerClient() {
  const { url, anonKey } = getSupabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Route Handlers and Server Actions can persist the refreshed
          // session cookies, so this is safe to ignore here.
        }
      },
    },
  });
}
