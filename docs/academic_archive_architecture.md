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
- UI (minimal by design): `/portal/archive` (own submissions + staff
  review queue), `/portal/archive/new`, `/portal/archive/[id]` (detail,
  versions, lifecycle), `/archive/[slug]` (public detail). No public
  listing/search UI yet; no in-place metadata-edit or grant-management
  UI yet (services and actions exist).

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
  environment, so the two new migrations, the RLS/trigger behavior, and
  the service flows are verified by typecheck, lint, build, dev-server
  smoke tests, and static audits only — runtime DB verification is still
  required before relying on this phase in production.
