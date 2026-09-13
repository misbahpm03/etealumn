# Profile Architecture (Phase 7)

Secure onboarding / profile / student / alumni / career / education / privacy
foundation. This document is the authority on how profile data flows, who may
touch it, and which invariants future phases must preserve.

## 1. Layering (provider-agnostic)

```
browser ──► server actions ──► ProfileService ──► repository interfaces ──► Supabase
(client    (features/profile/   (services/profile/   (@/repositories,        (infrastructure/
forms)      actions.ts)           bound per-request)   interfaces only)        supabase/*)
```

- App code depends on **repository interfaces** (`@/repositories`) and the
  `MediaStorageService` interface (`@/services/storage`). Only
  `src/infrastructure/*` imports the Supabase SDK.
- `ProfileService` is constructed **per request** with an already-resolved
  `SessionUser`: `new ProfileService(deps, appUser)`. Its methods take **no**
  `userId` parameter — ownership cannot be supplied by the browser.
- Server actions resolve identity via `requireActiveUser()` (server session →
  `users` row through RLS) and pass plain validated payloads to the service.

## 2. Identity & gating

- Identity is server-resolved: `users.auth_user_id = auth.uid()`. Client
  `user_id` values are never read (hidden `id` fields name *records*, and the
  service re-pins them to the bound user).
- `assertActiveUser` gates **every** method except `ensureInitialized`. Status
  is re-resolved per request from `users.status`: PENDING → `PENDING_ACCOUNT`,
  SUSPENDED → `SUSPENDED_ACCOUNT`, DEACTIVATED → `DEACTIVATED_ACCOUNT`.
- `assertRole` gates student/alumni methods against authoritative `users.role`
  and implies ACTIVE. There is **no** self-service role or status change;
  STUDENT→ALUMNI promotion is an admin operation (future phase).
- PENDING users are non-members: provisioning (`ensureInitialized`) is their
  only profile capability, and it never promotes.

## 3. Provisioning (idempotent, race-safe)

- `ensureInitialized()` provisions the caller's `profiles` + `profile_privacy`
  rows. Safe for any status (it writes only the caller's own rows, like the
  signup trigger).
- Placeholder name mirrors the provisioning trigger: email local-part, or
  `"New member"` when empty.
- Race safety comes from `UNIQUE(user_id)`: a conflicting concurrent insert
  raises `ConflictError`, and ensure falls back to re-reading the winner.
- Mutations that need the rows (`updateCurrentProfile`, `updateCurrentPrivacy`,
  photo ops) call `ensureInitialized()` first, so they succeed on fresh
  accounts.

## 4. Privileged operations (explicit allowlist)

The request client (RLS) is used everywhere RLS grants self-service.
Privileged (service-role, server-only) access exists ONLY for:

| Operation | Reason |
|---|---|
| profile/privacy ensure (find + create) | RLS has no self-INSERT for PENDING users by design |
| student/alumni create + update incl. verified fields | RLS offers no self-service INSERT here by design |
| audit writes | append-only, no client policy |

Privileged repos are separate deps (`profilesPrivileged`, `privacyPrivileged`);
the service never upgrades the request client. Batch reads/writes stay
admin-side (the service only *links* validated batch ids).

## 5. Validation (server-side, merged objects)

- All rules live in `src/validations/profile.ts` (pure/isomorphic) and run in
  the **service** on the final object — partial patches are merged with the
  stored row before cross-field checks (date/year order), so patches cannot
  create contradictory states.
- Enforced: lengths, year ranges (1900–2100, CHECK-mirrored), semesters 1–20,
  date-only validity (rejects `2026-02-30`, datetimes), `http(s)`-only URLs,
  UUID record/batch ids, booleans, enums.
- `student_id` is required on create, never null; `batchId` must be a UUID and
  must **exist** (`assertBatchExists`, else `VALIDATION_ERROR` on `batchId`).
  Both ACTIVE and ARCHIVED batches are linkable (archived = aged-out history).
- Client-side checks (if any) are UX hints only; service errors surface as
  field issues via the action result.

## 6. Privacy flags → future directory projections

- `profile_privacy` holds 8 `show*` flags. They are server-managed and are the
  **basis** for future public-directory projections — no feature may query raw
  `profiles.*` for public display.
- `DirectoryProfileService` (`services/profile/directory.service.ts`) is the
  only cross-user read abstraction: `getPublicProfile` (UUID-validated, view
  enforces ACTIVE + visibility) and `getMemberProfile` (ACTIVE requester
  required; the view applies per-row visibility + per-field flags). No
  directory UI exists yet; the service + views are the contract future UI
  must use.

## 7. Photo lifecycle (`profile-media`, private bucket)

- Uploads validate extension + MIME + size (25 MB uniform cap) **before** any
  storage call. Owner and requester are both the server-resolved user, and the
  object path is namespaced `profiles/{userId}/…` — writing into another
  user's path is structurally impossible.
- Replace order: upload new → swap pointer → audit → drop old object.
  - Pointer-update failure removes the **new** object (never orphaned) and
    rethrows; the old pointer is untouched; nothing is audited.
  - Old-object cleanup is **best-effort after** the swap, so a cleanup
    failure can never break the live reference.
- Reads go through short-lived **signed URLs** minted per request
  (`getProfilePhotoAccess`); the DB stores the path, never the URL.
- Remove with no photo is a silent no-op (no delete, no audit).

## 8. Onboarding (derived, never stored)

- `getOnboardingState()` computes from live records on every read: custom name
  (differs from trigger placeholder), photo presence, role-profile presence
  (STUDENT/ALUMNI only), work/education counts, and `complete`.
- No stored completion flag exists — nothing to desync, nothing to forge,
  nothing to migrate. ACTIVE-only (PENDING has no onboarding state to read).

## 9. Audit (security-sensitive mutations only)

Via `audit.record({ actorId, action, entityType, entityId, metadata })`:

| Action | Metadata (names/refs only) |
|---|---|
| `profile_privacy_updated` | `changed`: flag names |
| `student_profile_saved` | `created`, `fields`, `batchId` |
| `alumni_profile_saved` | `created`, `fields`, `batchId` |
| `profile_photo_updated` | `path`, `previousPath` |
| `profile_photo_removed` | `previousPath` |

No credentials, no PII values (`student_id` values excluded). Ordinary field
edits are deliberately not logged (noise).

## 10. RLS posture (authoritative)

- RLS is enabled on all six profile tables with owner-scoped policies keyed to
  `auth.uid()`; no permissive `USING (true)` on profile tables; privileged
  helpers are `SECURITY DEFINER` with fixed `search_path` (13/13 SQL-text
  checks, Phase 7).
- Application guards are defense-in-depth; the database remains the final
  authorization layer. Any future policy change needs a versioned migration
  plus a reasoning note here.

## 11. Minimal UI (Phase 7 scope)

- `/portal/profile` (overview: profile, privacy summary, role record, batch,
  career/education counts, signed photo), `/portal/profile/edit`,
  `/portal/profile/academic` (role-appropriate form only),
  `/portal/profile/career` (work + education lists, `?edit=` resolves against
  the caller's own loaded lists — foreign ids match nothing, no oracle),
  `/portal/onboarding` (derived checklist).
- Deletes use `window.confirm` (UX only — ownership enforced server-side).
- No portal/admin/directory/archive/opportunities/mentorship/stories UI in
  this phase.

## 12. Transport limits & production caveat

- `next.config.ts` sets `experimental.serverActions.bodySizeLimit: "26mb"` to
  honor the deliberate 25 MB validation contract (multipart overhead included).
  All actions are authenticated-only.
- **Caveat:** serverless function payload limits (~4.5 MB on Vercel-style
  hosts) will reject large uploads before validation. Future hardening:
  presigned direct-to-storage upload, keeping the same validation + audit
  semantics.

## 13. Test evidence (Phase 7)

- `npx tsc --noEmit`: clean. `npm run lint`: clean. `npm run build`: green
  (all profile routes dynamic; proxy detected).
- Service/validation harness (`/tmp`, throwaway): **142/142** — ensure
  idempotency + race fallback, status gating per method, role gating incl.
  status-first ordering, merged-object validation, batch existence, foreign-id
  `NOT_FOUND` (no oracle), photo replace/swap/remove lifecycles incl. DB-
  failure cleanup and best-effort tolerance, derived onboarding, directory
  gating, audit metadata shapes (no PII values), pure validator units.
- Server/client boundary: no `"use client"` module imports `@/services`,
  `@/repositories`, or `@/lib/supabase`; the only infrastructure import is the
  `"use server"` actions module.

## 14. Invariants for future phases

1. Never add a `userId` parameter to `ProfileService` methods.
2. Never query raw `profiles.*` for public display — extend the directory
   service + views.
3. Never store onboarding completion — keep deriving it.
4. Never widen privileged ops without documenting them in §4.
5. Never trust client-supplied role/status/batch existence.
6. Never put PII values in audit metadata.
