# Academic Archive Architecture

Phase 9: secure academic-document domain/lifecycle foundation. Provider-agnostic
services own validation, ownership, lifecycle, and auditing; Supabase is an
infrastructure detail behind repository/provider interfaces. RLS stays the
final database authorization; the services mirror it and never bypass it
except through the deliberate privileged seams listed below.

> Metadata, view, and download are three independent grants. Listing or
> describing a document never implies the right to open its file, and
> opening its file never implies the right to download it — each tier is
> authorized separately, on every request.

```
portal / public UI ──server actions / routes──▶ archive services
  │ AcademicDocumentService · DocumentPermissionService · DocumentSearchService
  │ repositories + StorageProvider (interfaces only — never Supabase)
  ▼
server-session factories ──request client (RLS) + privileged seams──▶
  │ SupabaseDocument* repos · SupabasePublicDocumentRepository
  │ AcademicDocumentStorageService + SupabaseStorageProvider
  ▼
PostgreSQL (RLS authoritative) + private `academic-archive` bucket
```

## Lifecycle

```
DRAFT ─▶ SUBMITTED ─▶ UNDER_REVIEW ─▶ APPROVED ─▶ ARCHIVED
                       │    ▲
                       ▼    │ REJECTED ─▶ DRAFT (rework loop)
                    REJECTED
```

- Creation always starts at DRAFT with a server-derived owner id; the
  browser supplies neither owner nor status (`AcademicDocumentService`
  hardcodes both, and the database rejects anything else).
- The browser never supplies a target status either: six explicit methods
  (`submit/beginReview/approve/reject/archive/reopen`) each encode one
  edge and call `requireTransition` first.
- `20260913050002_document_lifecycle_guard.sql` makes the database the
  final arbiter: a `BEFORE INSERT OR UPDATE` trigger rejects non-DRAFT
  inserts and off-map transitions with `23514`, which the error mapper
  surfaces as a `ValidationError` (the service check fires first in
  practice, so the trigger is a backstop, not the UX path).
- Approvals are staff-only (`MODERATOR`/`ADMIN`), server-stamped
  (`approved_by`/`approved_at`), and self-approval is rejected.
- Submission requires an active category, a year, and a description or
  abstract; approval requires an active category. Reopen clears
  `submitted_at`; soft-deleted rows accept no lifecycle changes.

## Visibility tiers (RLS-mirrored)

`public.can_access_document()` is authoritative; the service mirrors it
exactly (search backstop filter, download readability gate):

| Tier | APPROVED readers |
| --- | --- |
| `PUBLIC` | anyone, including anonymous |
| `STUDENT_ONLY` | active students and alumni |
| `FACULTY_ONLY` | active faculty, moderators, admins |
| `PRIVATE` | owner, grantees, admins (+ reviewers while in review) |

Review statuses (`SUBMITTED`/`UNDER_REVIEW`) are additionally readable by
active moderators and admins regardless of visibility, and moderators may
act on PRIVATE documents in review — moderation never depends on the
document's audience tier. Owners read their own rows in any live status;
admins read everything live. Deleted rows are invisible to every tier.

## Grants: VIEW vs DOWNLOAD

- Grants are explicit, per-user, per-document, and expirable
  (`expires_at`, null = no expiry); expired grants authorize nothing.
- VIEW and DOWNLOAD are independent: holding VIEW never implies download
  rights. A DOWNLOAD grant implies readability (view), never the reverse.
- Only owners and admins manage grants — moderators are deliberately
  excluded (review access is role-based, not grant-based). There is no
  direct-SQL grant path: `document_permissions` has a SELECT policy only,
  so grants can never be created, altered, or revoked except through the
  audited privileged seam.
- Re-granting is idempotent (updates the expiry); revoking an absent
  grant succeeds silently.

## Download authorization

`AcademicDocumentService.getDownloadAccess` runs the full tree BEFORE any
signed URL is minted: live row → readability (unreadable reads as 404,
never 403 — no existence oracle) → download rule → global
`allow_download` switch → version ownership. The download rule, in order:

1. owner (any live status) or active admin;
2. active moderator on `SUBMITTED`/`UNDER_REVIEW` (reviewers need the
   file, not just the metadata);
3. `APPROVED` + audience tier + `allow_download`;
4. unexpired DOWNLOAD grant + `allow_download` (any live status, so
   co-author drafts work — the global switch stays authoritative over
   grants, never the reverse).

Downloads require an authenticated identity (there is no anonymous
download path — every grant is audited with actor + version). Delivery is
a 302 to a 5-minute signed URL from `/api/archive/download/[id]`
(`?version=N` for history), with `Cache-Control: private, no-store`.
Status mapping is oracle-free: 404 unreadable, 403 readable-but-disabled
(the caller already knows it exists), 401 signed-out.

## Versions and files

- Files live in the private `academic-archive` bucket
  (`public = false`, self-healing upsert, no anon/authenticated storage
  policies — a path is never authorization).
- Objects are immutable: replacement always appends a new version at a
  fresh path; nothing ever overwrites or deletes a version object.
- Version numbers are unique per document (`UNIQUE(document_id,
  version_number)`); the constraint arbitrates races — on `ConflictError`
  the service reloads `maxVersionNumber` and retries the whole upload
  (fresh staging path per attempt, so a loser never deletes a winner's
  object). Creation inserts version 1 in the same compensated flow as the
  document row (upload → insert → version; failures remove exactly what
  is still unreferenced).
- Uploads validate against `FileValidationService` limits
  (`validateUploadForBucket`) before touching storage.
- Soft delete hides immediately and retains objects (immutable history);
  restore is admin-only.

## Search and public projection

- Member search runs inside the database under RLS (text, supervisor,
  keyword, category, batch, year, visibility, status, `ownOnly` — the
  last scoped by the caller's server-side id; anonymous member search is
  rejected). The service re-filters rows through the visibility tree as a
  backstop, then returns `DocumentSummary` rows (no storage paths, no
  approval internals).
- Anonymous reads go only through the `documents_public` projection
  (`20260913050001_archive_public_projection.sql`): explicit column list,
  `APPROVED` + `PUBLIC` only, no owner ids, no storage locations, no
  review/approval metadata. Author names resolve only for publicly
  eligible profiles (null otherwise).
- The public DTO is shared by search and detail so no field can creep
  back in on one path but not the other.

## Wiring map

- `src/services/archive/`: `AcademicDocumentService` (domain/lifecycle),
  `DocumentPermissionService` (grants), `DocumentSearchService`
  (discovery) — all depend on repository/provider interfaces only.
- `src/repositories/document.repository.ts`: `DocumentRepository`,
  `DocumentVersionRepository`, `DocumentPermissionRepository`,
  `DocumentCategoryRepository`, `PublicDocumentRepository` (+ privileged
  seams: explicit-id create, lifecycle/visibility writes, version
  inserts, grant checks).
- `src/infrastructure/supabase/server-session.ts`: the only composer —
  `createAcademicDocumentService`, `createDocumentPermissionService`,
  `createDocumentSearchService`, `listActiveDocumentCategories`.
- `src/features/archive/actions.ts`: thin server actions (FormData
  parsing + `requireActiveUser` + service call + revalidate).
- UI: `/portal/archive` (own submissions with category/batch names,
  edit links, resubmission paths), `/portal/archive/new`,
  `/portal/archive/[id]` (detail, versions, lifecycle, permissions),
  `/portal/archive/[id]/edit` (owner metadata edit, DRAFT/REJECTED),
  `/admin/archive` (staff moderation queue + approved-to-archive),
  `/archive/[slug]` (public detail). The Phase 9 portal-embedded staff
  queue was removed: staff shells redirect to `/admin`, so the admin
  queue is its only home. No public listing/search UI yet.

## Audit log actions

`document_created`, `document_version_uploaded`, `document_visibility_changed`,
`document_submitted`, `document_review_started`, `document_approved`,
`document_rejected`, `document_archived`, `document_reopened`,
`document_deleted`, `document_restored`, `document_downloaded` (with
version), `document_permission_granted`, `document_permission_revoked`.
Audit metadata carries references only — never file contents or paths.

## Migrations (Phase 9)

- `20260913050001_archive_public_projection.sql` — `documents_public`
  safe projection + anon `SELECT` (unverified against a live database —
  see below).
- `20260913050002_document_lifecycle_guard.sql` — INSERT-as-DRAFT +
  transition-map trigger (likewise unverified live).

No existing RLS was weakened and no bucket was made public. The guard
migration is additive; the pre-existing direct-SQL surface already
constrained owners to DRAFT/REJECTED rows, and the trigger additionally
closes direct-SQL creation at a non-DRAFT status.

## Open issues

- No `.env.local`/live Supabase and no local Postgres in this
  environment, so migrations, RLS/trigger behavior, and the service
  flows are verified by typecheck, lint, build, `npm test` (78
  deterministic tests), dev-server smoke tests, and static audits only
  — runtime DB verification is still required before relying on this
  phase in production. The runnable matrix is ready at
  `tests/rls-matrix.sql` (UNVERIFIED — never executed here).

## Phase 10 — final lifecycle matrix

The database trigger (`20260913050002`) is the final authority; the
service (`requireTransition` + `isAllowedTransition`) and the UI enforce
the same matrix first for honest errors. Allowed edges (6):

| From         | To           | Operation (actor)              |
| ------------ | ------------ | ------------------------------ |
| DRAFT        | SUBMITTED    | submit (owner)                 |
| SUBMITTED    | UNDER_REVIEW | begin review (moderator/admin) |
| UNDER_REVIEW | APPROVED     | approve (moderator/admin, never self) |
| UNDER_REVIEW | REJECTED     | reject (moderator/admin)       |
| REJECTED     | DRAFT        | reopen (owner or staff)        |
| APPROVED     | ARCHIVED     | archive (moderator/admin)      |

Every other ordered pair is rejected (30 rejections, asserted in
`tests/archive-lifecycle.test.ts`). ARCHIVED is terminal. INSERT is
DRAFT-only. There is deliberately no `updateDocument({ status })`-style
API anywhere: the service exposes no status-writing method (asserted in
`tests/archive-services.test.ts`), direct SQL cannot write `status`
(column revoked from the UPDATE grant), and the trigger rejects off-map
jumps even for service-role writers.

## Phase 10 — version concurrency behavior

`UNIQUE(document_id, version_number)` is the arbiter. Concurrent
creators each compute `maxVersionNumber + 1` from a stale read; the
loser's insert fails with a unique violation (mapped to
`ConflictError`), the service reloads the maximum and retries the whole
upload (max 3 attempts). Each attempt stages a fresh random path and the
loser's moved object is removed on insert failure, so a loser never
deletes a winner's object and no staging leftovers survive — asserted
end-to-end in the service tests with a simulated race (history stays
exactly `[1, 2, 3]`). Version rows are append-only by contract (no
update/delete on the repository or store) and objects are never
replaced in place.

## Phase 10 — moderation model

- The queue (`AcademicDocumentService.listReviewQueue`, staff-only) lists
  SUBMITTED + UNDER_REVIEW rows oldest-first with owner display names
  (privileged profile reads projecting to names ONLY — no emails,
  phones, or other profile fields), category/batch names, visibility,
  and submitted date. Unpaginated by design (minimal queue).
- `/admin/archive` renders the queue with inline explicit actions (Begin
  Review / Approve / Reject) plus per-row file download, and an
  "Approved — ready to archive" section with Archive actions. Review
  buttons are convenience only; every action re-authenticates the role,
  re-validates the current state, performs one explicit transition, and
  relies on the trigger.
- Moderators hold no admin powers: they cannot manage grants, users, or
  anything outside the review path. Admins retain full management
  authority (visibility anywhere, restore, all grants). No second admin
  role exists and no self-elevation path exists (role/status columns are
  not member-writable).
- Moderation reasons are NOT in the schema: rejection carries no reason
  field, and none was invented. Recorded reasons are a future
  enhancement (would need a migration + service/DTO/UI work).

## Phase 10 — permission behavior

Owners and admins (only) may grant VIEW or DOWNLOAD with an optional
future expiry and revoke at any time; re-granting updates the expiry and
revoking an absent grant succeeds silently. Recipients see their own
grants (`myPermissions`, surfaced on the document page); nobody can
grant themselves access to another member's document (non-managers are
rejected before any write; self-grants are rejected as invalid). VIEW
never implies download; DOWNLOAD implies readability but never
overrides `allow_download = false`. Expired grants authorize nothing —
not even readability — so an expired grant reads exactly as no grant
(404, no oracle).

## Phase 10 — download authorization order

`getDownloadAccess` implements the conservative rule in this order —
no signed URL exists before step 9 completes:

1. authenticate (active session required — no anonymous downloads, so
   every grant is attributable in the audit trail);
2. resolve the application user (server session, never input);
3. resolve the document (privileged load; deleted/missing → 404);
4. check lifecycle (owner/admin any live status; moderators on review
   statuses; audience/grant paths require APPROVED unless granted);
5. check visibility audience (PUBLIC/STUDENT_ONLY/FACULTY_ONLY/PRIVATE
   per the RLS mirror);
6. check unexpired VIEW/DOWNLOAD grants (DOWNLOAD honored on any live
   status for co-author drafts);
7. check `allow_download` (global switch wins over grants, never the
   reverse);
8. resolve the current or requested version (ownership verified);
9. mint a 5-minute signed URL, then audit `document_downloaded`.

The route maps outcomes oracle-free: 404 unreadable, 403
readable-but-disabled, 401 signed-out, 302 + `no-store` on success.

## Phase 10 — moderator / PRIVATE-document behavior

Question answered from the exact RLS (`can_access_document`): moderators
do NOT receive unrestricted PRIVATE access. They read PRIVATE documents
only while SUBMITTED/UNDER_REVIEW (the review path — any visibility, as
moderation must not depend on the author's audience tier), plus
APPROVED+PUBLIC, APPROVED+FACULTY_ONLY, owned rows, and explicitly
granted rows. APPROVED+PRIVATE without a grant is invisible to
moderators (verified by the service mirror and locked by regression
tests). Moderators cannot list grants, and all moderation writes flow
through the audited privileged seam — no direct-SQL moderation path
exists. No RLS change was needed.

Known limitation: moderation is queue-scoped, not assignment-scoped —
any active moderator can read ANY in-review document, not just assigned
ones. The schema has no review-assignment concept, so assignment-based
scoping cannot be expressed; inventing it without schema support would
be an insecure shortcut. Documented here instead.

## Phase 10 — runtime security test matrix

`tests/rls-matrix.sql` is the repeatable live-DB matrix (§17–§21):
seven personas (anon/pending/student/alumni/faculty/moderator/admin)
against eleven fixture documents (four visibilities × six statuses
plus deleted and private-author cases), asserting read counts on
`documents`, `documents_public`, `document_versions`, and
`document_permissions`; write denials (cross-user update, forged
ownership, direct status write, direct grant, version delete);
trigger/unique enforcement; and §21 public-view gating (eligibility,
field-level NULLs, staff/inactive exclusion) plus
column-absence checks on the projections. Transaction-wrapped with
synthetic identities; rolls back everything.

Why it was never executed: this environment has no Supabase project
(no `.env.local`, no service URL/keys) and no local Postgres
(`psql`/`pg_isready` absent, cannot install a server here), so the
PostgreSQL/PostgREST boundary is unreachable. Signed-URL runtime tests
(§20) additionally need the app + storage layers. Until the matrix runs
green against a non-production project, RLS/trigger/storage behavior is
verified statically only (migration review, 45-assertion script
self-check, service tests).

## Phase 10 — build investigation (§27)

The tracked Next.js 16/Turbopack `_global-error` build failure does NOT
reproduce: `next build` succeeds cleanly (verified repeatedly,
including on a fresh dependency install) with zero `_global-error`
errors, and the production server serves the archive routes. The
`global-error.tsx` boundary itself is minimal and correct (own
html/body, dependency-light). No matching upstream defect was found in
a search of Next.js 16 build issues (only unrelated Turbopack/CSS
reports). Determination: the application produces a valid production
build at this commit with Next 16.3.5 — the tracked issue either
affected a different version/path or is already resolved. Production
readiness is still gated on live-DB verification above, not on the
build.

## Phase 10 — known limitations

- Runtime DB/RLS/storage verification outstanding (see above).
- No moderation/rejection reasons in the schema (future enhancement).
- Moderation queue is unpaginated; grant recipients are keyed by UUID
  (no member picker); staff cannot open portal document pages (shell
  routing sends staff to `/admin`) — the admin queue covers review via
  inline actions + download, and a dedicated admin detail view is
  future work.
- No migration was required in Phase 10: the version-unique
  constraint, the lifecycle trigger, and the moderator RLS posture all
  verified correct as built (§28 — nothing created, nothing modified).
