# Storage Architecture

Provider-agnostic, server-mediated file storage. Supabase Storage is the
first provider behind the `StorageProvider` interface; application code works
with logical references (`provider`/`bucket`/`path`/filename/MIME/size) and
never with permanent provider URLs.

## Buckets (all private)

| Bucket | Purpose |
|---|---|
| `profile-media` | Avatars / profile photos (owner-controlled) |
| `academic-archive` | Theses, papers, reports + immutable versions |
| `story-media` | Story covers/attachments |
| `achievement-media` | Achievement evidence images |
| `department-memory-media` | Curated history media (staff-managed) |

Created by `20260913020001_storage_buckets.sql` with `public = false`,
25 MB `file_size_limit` backstops, and MIME allowlists (mirroring
`src/config/storage.ts` — keep in sync manually). No bucket is ever public:
even publicly visible content is delivered via short-lived signed URLs after
an authorization check, never via permanent public URLs.

## Access model

```
request → server verifies (RLS-gated record load) → privileged storage op
```

- **No client storage policies exist by design.** `storage.objects` has RLS
  enabled with zero policies for `anon`/`authenticated`, so browsers cannot
  list, download, upload, overwrite, or delete anything directly. Document
  visibility (status × visibility × grants × roles, via
  `can_access_document()`) is too complex for path-based policies — it stays
  in exactly one place (database RLS) instead of drifting across two.
- **Database first, URL second.** Downloads: the server loads the record
  through the requester's RLS context; a null record (invisible) yields
  `NotFoundError` and no URL is minted. Uploads: the server verifies
  ownership + lifecycle state before touching storage.
- **Paths are not authorization.** Objects carry random tokens and knowing a
  path grants nothing — every delivery re-validates against the record.

## Upload flow (academic, versioned)

`AcademicDocumentStorageService.uploadNewVersion` (server-only):

1. Record present, live, owned by requester, status DRAFT/REJECTED.
2. Validate claim (extension allowlist + MIME allowlist + extension↔MIME
   consistency + size bounds) — neither extension nor browser MIME trusted
   alone.
3. Upload bytes to same-bucket staging:
   `staging/{requesterId}/{token}/{sanitized}`.
4. `move` to the immutable version path:
   `documents/{docId}/versions/{n}/{token}/{sanitized}`.
5. Insert the `document_versions` row (number allocated atomically; unique
   constraint arbitrates races — caller reloads and retries on conflict).
6. Advance the document's current-file pointer.

Media uploads (`MediaStorageService`) follow the same validate→upload shape
with per-bucket image rules and fresh token paths per upload (unversioned:
the caller swaps the DB pointer, then removes the superseded object).

## Download flow

`getDownloadAccess` / `get*MediaAccess`: null record → `NotFoundError` (no
existence oracle); rule violation → `ForbiddenError`; otherwise mint a
signed URL (default 15 minutes for downloads, 1-hour backstop) and return
`{ url, expiresAt }` — never persisted. Media additionally requires
ownership, publication, or staff status per kind; drafts are unreachable.

## Versioning & replacement

Archive objects are immutable: replacement ALWAYS appends a new version
(the document service never calls provider `replace`). Old versions stay
stored and readable as history. `replace` exists on the provider solely for
unversioned media, and even there the services mint fresh paths instead.

## Soft deletion

`documents.deleted_at` hides the record (and its files — the service refuses
deleted records) but deletes nothing: metadata, versions, and objects all
survive for recovery. No user-facing physical deletion exists; permanent
cleanup is an explicit future process, never a broad delete policy.

## Orphan handling

Ordering keeps the database consistent without distributed transactions:
objects exist BEFORE any row references them. Per-step best-effort rollback
removes exactly what is still unreferenced (staging on move failure; final
object when the version insert fails; nothing once a version row exists —
pointer retry is the recovery). Stragglers (crash between steps, superseded
media whose cleanup never ran) are found by a future reconciliation job over
the `staging/` prefix and unreferenced objects (grace period, then
quarantine/delete). `isStagingPath()` marks that scope.

## Validation strategy

Central rules in `src/config/storage.ts` (`STORAGE_VALIDATION`), pure
validators in `src/validations/uploads.ts`, enforced in services on every
upload and mirrored as bucket guardrails. Banned everywhere: executables,
scripts, HTML/SVG. Known gap (documented, not ignored): claims are
validated, bytes are not yet sniffed — magic-byte verification and malware
scanning are future hardening.

## Privileged access boundary

Exactly two privileged patterns, both server-only via constructor-injected,
service-role-backed providers (never imported into browser code; no
`NEXT_PUBLIC_*` service keys):

1. **Sign minting** — after RLS proved visibility (user-context clients
   cannot sign what storage RLS denies them).
2. **Upload/move/remove** — after the service verified ownership + state.

Services import no Supabase modules and no admin client — server
actions/handlers inject the provider. Storage errors surface only as
translated `AppError`s (`toAppError` + `ValidationError` issues).

## Provider migration

Replace `SupabaseStorageProvider` with another `StorageProvider`
implementation (same-bucket `move` required — S3-native copy+delete can
implement it) and remap `toPhysicalBucket`-style logical→physical names.
Database records, services, paths, and validation move unchanged; bucket
MIME/size backstops get re-expressed per provider.
