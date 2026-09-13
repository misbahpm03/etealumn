import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/config/env";
import { isNetworkErrorMessage } from "./errors";

export interface SupabaseConnectivity {
  configured: boolean;
  reachable: boolean;
  latencyMs: number | null;
}

/**
 * Minimal connectivity probe: verifies the app can initialize Supabase and
 * reach the project endpoint. Uses a stateless anon client and `getUser`,
 * which needs no database tables — any HTTP response (even "session
 * missing") proves reachability. Only network-level failures count as
 * unreachable. Exposes booleans and latency only, never URLs or keys.
 */
export async function checkSupabaseConnectivity(): Promise<SupabaseConnectivity> {
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    return { configured: false, reachable: false, latencyMs: null };
  }

  const startedAt = Date.now();
  try {
    const client = createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.auth.getUser();
    const networkFailure =
      error !== null &&
      typeof error.message === "string" &&
      isNetworkErrorMessage(error.message);
    return {
      configured: true,
      reachable: !networkFailure,
      latencyMs: Date.now() - startedAt,
    };
  } catch {
    return { configured: true, reachable: false, latencyMs: Date.now() - startedAt };
  }
}
