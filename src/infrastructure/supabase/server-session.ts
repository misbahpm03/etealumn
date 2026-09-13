import "server-only";

import { MissingAppUserError } from "@/lib/errors";
import {
  assertActiveUser,
  assertAnyRole,
  assertAppUser,
  assertAuthenticated,
  assertRole,
} from "@/services/auth/guards";
import type {
  AuthIdentity,
  SessionUser,
  UserRole,
} from "@/types";
import {
  DirectoryProfileService,
  MediaStorageService,
  ProfileService,
} from "@/services";
import { createSupabaseAdminClient } from "./admin";
import { isNetworkErrorMessage, toAppError } from "./errors";
import { createSupabaseServerClient } from "./server";
import { SupabaseAuthProvider } from "./supabase-auth.provider";
import { SupabaseAuditLogRepository } from "./supabase-audit-log.repository";
import { SupabaseBatchRepository } from "./supabase-batch.repository";
import { SupabaseEducationRepository } from "./supabase-education.repository";
import {
  SupabaseProfilePrivacyRepository,
  SupabaseProfileRepository,
} from "./supabase-profile.repository";
import { SupabasePublicProfileRepository } from "./supabase-public-profile.repository";
import { SupabaseAlumniProfileRepository } from "./supabase-alumni-profile.repository";
import { SupabaseStorageProvider } from "./supabase-storage.provider";
import { SupabaseStudentProfileRepository } from "./supabase-student-profile.repository";
import { SupabaseUserRepository } from "./supabase-user.repository";
import { SupabaseWorkExperienceRepository } from "./supabase-work-experience.repository";

/**
 * Request-scoped server session wiring: the ONE place that composes the
 * Supabase server client with the application session model.
 *
 * - Identity comes from `auth.getUser()` (verified with the Auth server —
 *   cookie claims alone are never trusted).
 * - Role/status come from `public.users` via the request-scoped client, so
 *   RLS applies to the lookup itself (users can only read their own row).
 * - `require*` helpers are thin server conveniences over the pure asserts
 *   in `services/auth/guards` — they do NOT replace RLS.
 */

/** "No usable session" failures read as signed-out, never as 500s. */
function isSessionAbsentError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error ?? "");
  return /session.+missing|missing.+session|invalid.+token|token.+invalid|expired|refresh.+token.+not.+found|auth.+session.+missing/i.test(
    message,
  );
}

/** Verified Supabase identity, or null when signed out. */
export async function getCurrentAuthUser(): Promise<AuthIdentity | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    if (isSessionAbsentError(error)) {
      return null;
    }
    if (isNetworkErrorMessage(error.message)) {
      // Auth unreachable: fail CLOSED (signed-out) so visitors land on the
      // sign-in form instead of a 500 — submit then reports the outage
      // clearly. Logged server-side so outages stay visible.
      console.warn("[auth] Supabase unreachable; treating as signed out");
      return null;
    }
    throw toAppError(error, "Could not load the signed-in user.");
  }
  if (!data.user) {
    return null;
  }
  return {
    authUserId: data.user.id,
    email: data.user.email ?? null,
    emailConfirmedAt: data.user.email_confirmed_at ?? null,
  };
}

/**
 * Application principal (identity + `public.users` role/status), or null
 * when signed out OR unprovisioned. Layouts distinguish the two via
 * `getCurrentAuthUser()` when the messaging needs it.
 */
export async function getCurrentAppUser(): Promise<SessionUser | null> {
  const identity = await getCurrentAuthUser();
  if (!identity) {
    return null;
  }
  const supabase = await createSupabaseServerClient();
  const appUser = await new SupabaseUserRepository(supabase).findByAuthUserId(
    identity.authUserId,
  );
  if (!appUser) {
    return null;
  }
  return { ...appUser, emailVerifiedAt: identity.emailConfirmedAt };
}

/**
 * Request-scoped auth provider with the session-user resolver wired to
 * `public.users`. Used by auth server actions (sign-in/out, password flows).
 */
export async function createRequestAuthProvider(): Promise<SupabaseAuthProvider> {
  const supabase = await createSupabaseServerClient();
  const users = new SupabaseUserRepository(supabase);
  return new SupabaseAuthProvider(supabase, async ({ authUserId, emailVerifiedAt }) => {
    const appUser = await users.findByAuthUserId(authUserId);
    if (!appUser) {
      throw new MissingAppUserError();
    }
    return { ...appUser, emailVerifiedAt };
  });
}

/**
 * Privileged user repository (service-role, bypasses RLS). ONLY for system
 * writes the user must not perform themselves (`touchLastLogin`) and future
 * admin operations — never for reads the request client can do.
 */
export function createPrivilegedUserRepository(): SupabaseUserRepository {
  return new SupabaseUserRepository(createSupabaseAdminClient());
}

/** Require a verified Supabase identity (any provisioning state). */
export async function requireAuthenticatedUser(): Promise<AuthIdentity> {
  const identity = await getCurrentAuthUser();
  assertAuthenticated(identity);
  return identity;
}

/** Require identity + provisioned app row (any status). */
export async function requireAppUser(): Promise<SessionUser> {
  const appUser = await getCurrentAppUser();
  assertAppUser(appUser);
  return appUser;
}

/** Require a provisioned ACTIVE user. */
export async function requireActiveUser(): Promise<SessionUser> {
  const appUser = await getCurrentAppUser();
  assertActiveUser(appUser);
  return appUser;
}

/** Require an ACTIVE user with exactly this role. */
export async function requireRole(role: UserRole): Promise<SessionUser> {
  const appUser = await getCurrentAppUser();
  assertRole(appUser, role);
  return appUser;
}

/** Require an ACTIVE user with one of these roles. */
export async function requireAnyRole(
  roles: ReadonlyArray<UserRole>,
): Promise<SessionUser> {
  const appUser = await getCurrentAppUser();
  assertAnyRole(appUser, roles);
  return appUser;
}

/** Require an ACTIVE student or alumnus. */
export async function requireStudentOrAlumni(): Promise<SessionUser> {
  return requireAnyRole(["STUDENT", "ALUMNI"]);
}

/** Require ACTIVE faculty. */
export async function requireFaculty(): Promise<SessionUser> {
  return requireRole("FACULTY");
}

/** Require an ACTIVE moderator. */
export async function requireModerator(): Promise<SessionUser> {
  return requireRole("MODERATOR");
}

/** Require an ACTIVE admin. */
export async function requireAdmin(): Promise<SessionUser> {
  return requireRole("ADMIN");
}

/** Require ACTIVE staff (moderator or admin — mirrors `is_staff()`). */
export async function requireStaff(): Promise<SessionUser> {
  return requireAnyRole(["MODERATOR", "ADMIN"]);
}

/**
 * Per-request ProfileService for a server-resolved user: request-client
 * repos (RLS self-service) + privileged repos ONLY for the deliberate
 * server-side seams (ensure, student/alumni upserts, audit, photo
 * storage). Call with `requireActiveUser()` (portal flows) — the service
 * re-asserts ACTIVE on every method regardless.
 */
export async function createProfileService(
  appUser: SessionUser,
): Promise<ProfileService> {
  const request = await createSupabaseServerClient();
  const privileged = createSupabaseAdminClient();
  return new ProfileService(
    {
      profiles: new SupabaseProfileRepository(request),
      profilesPrivileged: new SupabaseProfileRepository(privileged),
      privacy: new SupabaseProfilePrivacyRepository(request),
      privacyPrivileged: new SupabaseProfilePrivacyRepository(privileged),
      students: new SupabaseStudentProfileRepository(privileged),
      alumni: new SupabaseAlumniProfileRepository(privileged),
      work: new SupabaseWorkExperienceRepository(request),
      education: new SupabaseEducationRepository(request),
      batches: new SupabaseBatchRepository(request),
      audit: new SupabaseAuditLogRepository(privileged),
      photos: new MediaStorageService(new SupabaseStorageProvider(privileged)),
    },
    appUser,
  );
}

/**
 * Safe-projection directory service (request client — the views enforce
 * visibility + flags). No directory UI consumes it yet (later phase).
 */
export async function createDirectoryProfileService(): Promise<DirectoryProfileService> {
  const request = await createSupabaseServerClient();
  return new DirectoryProfileService(
    new SupabasePublicProfileRepository(request),
  );
}
