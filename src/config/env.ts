import { ServiceNotConfiguredError } from "@/lib/errors";

/**
 * Typed environment access.
 *
 * - `publicEnv` is safe to import in client components (NEXT_PUBLIC_* only).
 * - Server-only secrets MUST be read via `serverEnv` and never imported from
 *   client components. Service-role credentials stay server-side, always.
 *
 * Values are optional at boot so the app starts without provider
 * credentials. Provider factories call `getSupabasePublicConfig()`, which
 * throws a structured error when configuration is missing.
 */

export interface PublicEnv {
  /** Supabase project URL, e.g. https://xyz.supabase.co */
  supabaseUrl: string | undefined;
  /** Supabase anonymous (public) key — safe for browser use. */
  supabaseAnonKey: string | undefined;
  /** Canonical site URL used for metadata and links. */
  siteUrl: string;
}

export const publicEnv: PublicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
};

/** True once the minimum public provider configuration is present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

/**
 * Resolve the public Supabase configuration, throwing a structured
 * `ServiceNotConfiguredError` when it is absent. Single choke point so
 * every provider factory fails the same way.
 */
export function getSupabasePublicConfig(): SupabasePublicConfig {
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    throw new ServiceNotConfiguredError(
      "Supabase (set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    );
  }
  return { url: publicEnv.supabaseUrl, anonKey: publicEnv.supabaseAnonKey };
}

/**
 * Server-only environment. Importing this module from a client component is a
 * bug — server secrets must never be bundled for the browser.
 */
export interface ServerEnv {
  /** Supabase service-role key. SERVER ONLY — bypasses RLS. */
  supabaseServiceRoleKey: string | undefined;
}

export const serverEnv: ServerEnv = {
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
};
