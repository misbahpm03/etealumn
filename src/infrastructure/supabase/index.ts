/**
 * Universal (isomorphic-safe) Supabase infrastructure.
 *
 * Deliberately NOT re-exported here:
 * - `./server` — `next/headers` + `server-only`; import directly from server
 *   modules only.
 * - `./admin` — service-role key + `server-only`; import directly from
 *   server modules only, and only when the anon client cannot do the job.
 * - `./health` — server-side probe used by the dev-only status route.
 */
export { createSupabaseBrowserClient } from "./client";
export {
  isNetworkErrorMessage,
  toAppError,
  unwrapQuery,
} from "./errors";
export {
  SupabaseAuthProvider,
  type SessionUserResolver,
} from "./supabase-auth.provider";
export { SupabaseStorageProvider } from "./supabase-storage.provider";
