import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig, serverEnv } from "@/config/env";
import { ServiceNotConfiguredError } from "@/lib/errors";

/**
 * Privileged service-role client. BYPASSES RLS — server-only, and blocked
 * from browser bundles by the `server-only` import above.
 *
 * NOT USED in Phase 2. Reserved for future administrative operations (user
 * provisioning, storage maintenance) from Phase 3 onwards. Every future
 * caller must justify why the anon-key client cannot do the job.
 */
export function createSupabaseAdminClient() {
  const { url } = getSupabasePublicConfig();
  const serviceRoleKey = serverEnv.supabaseServiceRoleKey;
  if (!serviceRoleKey) {
    throw new ServiceNotConfiguredError(
      "Supabase service role (set SUPABASE_SERVICE_ROLE_KEY server-side)",
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
