/**
 * Universal (isomorphic-safe) Supabase infrastructure.
 *
 * Deliberately NOT re-exported here:
 * - `./server` — `next/headers` + `server-only`; import directly from server
 *   modules only.
 * - `./admin` — service-role key + `server-only`; import directly from
 *   server modules only, and only when the anon client cannot do the job.
 * - `./server-session` — request-scoped session wiring (`server-only`);
 *   import directly from server actions, route handlers, and layouts only.
 * - `./middleware-client` — request-proxy-only cookie adapter; import from
 *   `src/proxy.ts` only.
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
export { SupabaseUserRepository } from "./supabase-user.repository";
export { SupabaseAuditLogRepository } from "./supabase-audit-log.repository";
export { SupabaseBatchRepository } from "./supabase-batch.repository";
export { SupabaseEducationRepository } from "./supabase-education.repository";
export {
  SupabaseProfilePrivacyRepository,
  SupabaseProfileRepository,
} from "./supabase-profile.repository";
export { SupabasePublicProfileRepository } from "./supabase-public-profile.repository";
export { SupabaseAlumniProfileRepository } from "./supabase-alumni-profile.repository";
export { SupabaseStudentProfileRepository } from "./supabase-student-profile.repository";
export { SupabaseWorkExperienceRepository } from "./supabase-work-experience.repository";
