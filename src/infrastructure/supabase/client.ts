import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/config/env";

/**
 * Browser-side Supabase client (anon key only — RLS still applies).
 * Safe to import from client components; creates one client per call, so
 * callers should memoize or share a module-level instance per component tree.
 */
export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabasePublicConfig();
  return createBrowserClient(url, anonKey);
}
