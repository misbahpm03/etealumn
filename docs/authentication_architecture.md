# Authentication Architecture

Phase 6: Supabase Auth proves **identity**; `public.users` decides
**authorization**. The two are never confused, and the browser determines
neither its role nor its status.

```
Supabase Auth (auth.users) ──identity/session/credentials/verification──▶
  │ handle_new_user trigger (STUDENT + PENDING, minimal profile)
  ▼
public.users (role + status) ──application authorization──▶
  │ 1:1, server/admin-managed
  ▼
profiles / student_profiles / alumni_profiles ──who the member is──▶
  │ everything read through…
  ▼
RLS (final database authorization) + Storage (file authorization)
```

## Authentication flow (email/password)

```
sign-in form ──server action──▶ signInWithPassword (request client)
  ▶ session cookie set server-side ▶ load app user (RLS self-read)
  ▶ touch last_login_at (privileged, best-effort)
  ▶ resolvePostAuthDestination(appUser) ──same-shell `next` only──▶ redirect
```

No public registration exists: accounts enter via Supabase invite/dashboard
(or provider sign-up where enabled), and the database trigger provisions the
app row. There is intentionally no `signUp` call anywhere in `src/`.

## Application-user provisioning

Migration `20260913030001_auth_provisioning.sql`: `handle_new_user()`
(`SECURITY DEFINER`, fixed `search_path`) fires `AFTER INSERT ON auth.users`
and inserts, in one transaction:

- `users(auth_user_id = NEW.id, email = lower(NEW.email), role = 'STUDENT',
  status = 'PENDING')` — `ON CONFLICT (auth_user_id) DO NOTHING`, with a
  replay branch that finishes provisioning when the row pre-exists (restores
  never downgrade an existing role/status);
- a minimal `profiles` row (`full_name` = email local-part, editable later);
- a default `profile_privacy` row (email hidden).

`WHEN (NEW.email IS NOT NULL)`: phone-only identities are skipped rather
than half-provisioned (the app is email-based). Any authenticated session
without an app row surfaces as "account setup incomplete"
(`MissingAppUserError`), never as a guest account.

## Role/status model

- **Roles** (`user_role`): `STUDENT` (default), `ALUMNI`, `FACULTY`,
  `MODERATOR`, `ADMIN`. Nothing in a request — body, URL, query, storage,
  or JWT metadata — can set a role: `authenticated` holds no INSERT/UPDATE
  grant on `users` at all, and no code path reads role from client input
  (verified by audit grep).
- **Statuses** (`user_status`): `PENDING` (default), `ACTIVE`, `SUSPENDED`,
  `DEACTIVATED`. Authenticated ≠ member: every role check (RLS helpers and
  app guards alike) implies `ACTIVE`.
- **Elevation** is admin-only and UI-less in this phase: `updateRole` /
  `updateStatus` exist on the repository for privileged (service-role)
  callers; the admin user-management UI is a later phase.

## Session handling

- Identity is read with `auth.getUser()` (verified against the Auth server),
  never from cookie claims. No tokens in `localStorage`, no manual cookie
  handling — `@supabase/ssr` manages the session lifecycle.
- `getCurrentAuthUser()` → verified identity or null (signed out, expired,
  or Auth unreachable — the last fails **closed** to signed-out with a
  server-side warning, so outages show the sign-in form instead of a 500).
- `getCurrentAppUser()` → identity + `users` row (role/status) via the
  request client, so RLS applies to the lookup itself.
- Pure asserts (`assertAuthenticated`, `assertAppUser`, `assertActiveUser`,
  `assertRole`, `assertAnyRole`) narrow a loaded principal; `require*`
  server conveniences (`requireActiveUser`, `requireStudentOrAlumni`,
  `requireFaculty`, `requireModerator`, `requireAdmin`, `requireStaff`, …)
  load + assert. Guards are application-layer conveniences — RLS stays final.
- Sign-out clears the session server-side via the request client; the UI
  only navigates afterwards.

## Server/client boundaries

| Module | Side | Notes |
|---|---|---|
| `infrastructure/supabase/client` | browser-safe | anon key; RLS applies |
| `infrastructure/supabase/server` | server-only | `server-only` + `next/headers` |
| `infrastructure/supabase/admin` | server-only | service-role; login bookkeeping + future admin ops |
| `infrastructure/supabase/server-session` | server-only | session loaders + `require*` |
| `infrastructure/supabase/middleware-client` | proxy-only | no `server-only` (proxy runtime) |
| `services/auth/guards`, `destination` | isomorphic | pure, unit-tested, proxy-safe |
| `services/auth/audit` | server-only | audit sink seam |
| `features/auth/actions` | server actions | composition edge; safe results only |
| `features/auth/*-form`, `sign-out-button` | client | forms call actions; no Supabase imports |

Client components import no `server-only` module, no Supabase SDK, and no
service-role material (build passes, client chunks verified clean, proxy
imports verified runtime-safe). Server actions are the documented
composition edge: the only app-layer modules that name concrete Supabase
wiring — all decisions live in provider-agnostic guards/routing/validation.

## Password reset

Request action → `resetPasswordForEmail` with
`{Site URL}/auth/callback?next=/reset-password` (host must be allow-listed
in the Supabase dashboard). Responses are **always generic success**, valid
address or not. The emailed link hits the callback, which exchanges the
one-time code for a recovery session and routes to `/reset-password`
(same-shell `next` honored). The update form enforces length rules
server-side (8 chars … 72 bytes); mismatch is caught before submission.

## Email verification

When Supabase "confirm email" is on (production), unverified users cannot
establish sessions (`email_not_confirmed` → `EmailNotVerifiedError`), and
verification links flow through the callback like any other email link. The
app additionally treats `emailVerifiedAt = null` as a routing state
(`/verify-email`, with generic re-send) — defense in depth for configurations
where a session exists pre-verification. Verification never implies ACTIVE
membership; status still decides.

## Route protection (three layers, one table)

1. **Request proxy** (`src/proxy.ts`, Next 16 convention): refreshes the
   session; signed-out → `/signin` (shell paths keep a `next`); signed-in
   routed by the shared destination table (auth pages self-heal, shells stay
   consistent, session-gated pages hard-redirect). Coarse only.
2. **Layouts/pages**: portal/admin shells re-verify per request
   (`force-dynamic` — guarded routes must never prerender statically) and
   redirect off-destination visitors. Same table, second layer.
3. **RLS**: every query authorized by database policy regardless of routing.

`resolvePostAuthDestination`: signed out → `/signin`; unverified →
`/verify-email`; non-ACTIVE → `/account-status`; ACTIVE staff →
`/admin/dashboard`; ACTIVE member → `/portal/dashboard`. `next` parameters
pass an open-redirect guard (same-origin path, no `//`, no backslashes) and
are honored only within the destination's shell.

## Authorization responsibilities (do not collapse)

- Supabase Auth: identity, session, credentials, email verification.
- `public.users`: application role + status.
- `profiles`: public/member profile information.
- `student_profiles` / `alumni_profiles`: role-specific information.
- RLS: database authorization (final).
- Storage: file authorization (server-mediated, signed URLs).

## Security assumptions

- The Supabase project enables email confirmation in production; JWTs are
  validated by `getUser()`; the service-role key exists only server-side.
- Emailed-link hosts are allow-listed in the dashboard; `NEXT_PUBLIC_SITE_URL`
  matches the canonical host.
- RLS policies from Phase 4 are applied (no `users` writes for
  `authenticated`); the provisioning trigger is installed.
- Without Supabase configured, auth degrades to pass-through rendering so
  UI work continues — this mode must never face real users (no guards run).
- Auth unreachable at runtime fails closed to signed-out (logged); audit
  events go to structured server logs (ids only, never emails/tokens).

## Error model & enumeration hygiene

Typed errors: `InvalidCredentialsError` (one message for wrong
password/unknown account), `SessionExpiredError`, `EmailNotVerifiedError`,
`Pending/Suspended/DeactivatedAccountError`, `MissingAppUserError` /
`MissingProfileError` (500s with safe messages). Provider internals stay on
`cause` for server logs; UI sees safe messages only. Login, password-reset,
and verification re-send reveal nothing about account existence.

## Audit boundary

`services/auth/audit` exposes `AuthAuditLogger` (`login`, `logout`,
`password_reset_requested`, `password_updated`, `verification_email_resent`,
`role_changed`, `status_changed`) with a structured-logging default sink.
Auth flows already emit these events; the later audit phase swaps in a
database sink without touching call sites. Users can never write audit
records (server-only logger, privileged future sink, RLS authoritative).

## Future role-management strategy

Role/status changes stay administrative: privileged repository methods exist
(`updateStatus`, `updateRole`), and a later phase adds an admin-only UI +
server actions calling them with the service-role repository, each change
emitting `role_changed`/`status_changed` audit events. Invitation-based
faculty/alumni/admin onboarding builds on the same seam (invite → trigger
provisions PENDING STUDENT → admin verifies and elevates). Never add
self-selected roles.
