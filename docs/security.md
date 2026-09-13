# Security Model

Deny-by-default, database-enforced authorization. No one gains access merely
by being authenticated: every read/write is granted explicitly through
ownership, ACTIVE status, role, visibility rules, explicit document grants,
or staff authority — checked by PostgreSQL RLS on every query.

UI role checks and TypeScript guards are UX conveniences only. They are never
the enforcement layer.

## Identity model

```
Supabase Auth user (auth.users.id, from JWT `sub` via auth.uid())
        │  1:1, application-managed (no FK to auth.* — portability)
        ▼
public.users.auth_user_id → application user { role, status }
```

Roles and statuses live ONLY in `public.users`. They are never read from
client-controlled JWT metadata, and no API role can write them (see below).

## Helper functions (`20260913010001`)

All `STABLE`, `SECURITY DEFINER`, `SET search_path = public`:

| Function | Meaning |
|---|---|
| `current_app_user_id()` | Caller's `users.id` or NULL |
| `current_user_role()` / `current_user_status()` | Caller's role / status or NULL |
| `is_active_user()` | `status = 'ACTIVE'` |
| `is_admin()` / `is_moderator()` / `is_faculty()` / `is_student()` / `is_alumni()` | Role **and** ACTIVE |
| `is_student_or_alumni()` | STUDENT or ALUMNI, ACTIVE |
| `is_staff()` | MODERATOR or ADMIN, ACTIVE |
| `owns_document(uuid)` | Caller owns the document |
| `can_access_document(uuid)` | Full document read rule (single source of truth) |

**Why DEFINER:** policies on `public.users` must test the caller's role, and
an invoker-rights read of `users` from a `users` policy recurses infinitely;
likewise `owns_document`/`can_access_document` break the
documents→permissions→documents cycle. Each function is narrow (fixed
`auth.uid()` predicate, no caller-chosen user, no dynamic SQL, no writes),
and a missing user record returns NULL → deny. EXECUTE stays granted to
`anon`/`authenticated` because their policies must call these; the functions
reveal nothing beyond the caller's own identity.

**Role helpers imply ACTIVE.** There is no privileged-but-inactive state —
PENDING/SUSPENDED/DEACTIVATED hold zero member privileges, with no admin
backdoor in Phase 4.

## Two enforcement layers

1. **GRANTs** (`20260913010002`) — per-role, per-operation, per-column.
   `anon` gets SELECT on 7 public-audience tables + 1 view only.
   `authenticated` gets SELECT broadly (rows still filtered by policy) and
   narrow write lists. Sensitive columns — `users.*` writes, `status`,
   `visibility` changes, approvals, `owner_id`/`posted_by` reassignment,
   storage pointers, `deleted_at`, `granted_by` — are revoked from direct
   writes for **everyone including admins**.
2. **RLS policies** (`10003`–`10005`) — per-row rules on all 19 tables
   (RLS enabled, not forced: table owners and the service role bypass by
   design; the service role is server-side-only, never in browsers).

## Lifecycle protection strategy

Owners draft directly (INSERT + DRAFT/REJECTED-only UPDATE of safe columns).
Everything else is an **audited server-side operation** (service role):

- status transitions (submit, approve, reject, publish, archive)
- visibility changes, soft delete / restore, hard delete
- approval fields (`approved_by/at`, `submitted_at`, `published_at`)
- document grant management, file replacement + version rows
- user provisioning, role/status changes, batch assignment, student ids
- notifications creation, audit log writes, department-history curation

Direct SQL structurally cannot: self-approve, self-publish, impersonate
owners/posters, forge `granted_by`, self-grant document access, escalate
roles, reactivate accounts, or create academic-identity rows for others.

## Document read rule (`can_access_document`)

Live row (`deleted_at IS NULL`) AND owner (any status) OR APPROVED+PUBLIC
(anyone) OR APPROVED+STUDENT_ONLY (active students/alumni) OR
APPROVED+FACULTY_ONLY (active faculty/staff) OR SUBMITTED/UNDER_REVIEW
(active moderators/admins, for review queues) OR unexpired explicit grant to
an active user OR active admin. `document_versions` uses the identical
function, so versions can never bypass document visibility.

## Public access model

Anonymous reads are limited to: batches, active categories, APPROVED+PUBLIC
live documents (+ their versions), PUBLISHED stories/achievements/history,
and the `profiles_public` projection. Everything else — users, raw profiles,
privacy settings, student/alumni records, permissions, opportunities,
mentorship, notifications, audit logs — denies anon at both GRANT and RLS
layers. No public policy exposes email, phone, student_id, storage
credentials, or grant records.

## Profile privacy model

Raw `profiles` is owner/admin-only (it holds phone/socials). Cross-user reads
use two owner-rights, `security_barrier` views projecting safe columns with
per-field `show_*` flags applied (`10006`):

- `profiles_public` (anon + members): ACTIVE + opted into public listing +
  visibility PUBLIC. Phone/email never selected.
- `profiles_member` (active members): ACTIVE + visibility admits the viewer
  (PUBLIC all; STUDENT_ONLY students/alumni; FACULTY_ONLY faculty/staff).

No student/alumni directory projection exists yet — cross-user reads of those
tables are denied until the directory feature defines its own safe
projection (deny-by-default; server-side assembly remains possible).

## Deliberate access decisions (auditable)

- Moderators read review queues + PUBLIC content, not approved member-only
  content; no user management, no audit access, no direct publishing.
- Faculty are excluded from opportunities and mentorship discovery (not
  granted automatically, per product model).
- Admins read broadly but write sensitive fields only via audited server
  operations — direct `UPDATE users` is impossible even for admins.
- Owners can read their own data regardless of status (transparency); all
  direct writes require ACTIVE.
- `audit_logs` additionally rejects UPDATE/DELETE via trigger for every
  role except the FK-driven `actor_id → NULL` on user deletion.

## Assumptions & future tasks

- Assumes Supabase roles `anon`/`authenticated` and `auth.uid()` exist
  (test harness stubs both; production provides them).
- Storage bucket policies arrive in Phase 5 and should reuse
  `can_access_document()` for file authorization.
- Server-side operations (service role) for all revoked mutations are a
  later phase; until then those actions simply have no API path.
- Consider later: member directory projection, moderator access to
  approved member-only content for takedowns, admin notification support
  reads, audit read access for moderators if genuinely required.
