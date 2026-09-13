# Database

PostgreSQL schema for the alumni + academic archive platform (one database,
three surfaces: public site, member portal, admin CMS).

- **Source of truth:** `supabase/migrations/*.sql` (forward-only, never edit
  an applied migration — add a new one).
- **Portability:** plain PostgreSQL; no Supabase-specific database objects.
  `users.auth_user_id` intentionally has **no FK to `auth.users`** — the link
  to the auth provider is application-managed (see `0002` header comment).
- **Assumptions:** PostgreSQL 13+ (`gen_random_uuid()` built in; Supabase
  provides 15+). No extensions installed; `pg_trgm`/FTS indexes arrive with
  the search phase.

## Applying migrations

Via Supabase CLI (recommended, once a project is linked):

```bash
supabase db push
```

Or with plain `psql` against any PostgreSQL 13+ database, in filename order:

```bash
for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
```

## Enums

| Enum | Values |
|---|---|
| `user_role` | STUDENT, ALUMNI, FACULTY, MODERATOR, ADMIN |
| `user_status` | PENDING (default), ACTIVE, SUSPENDED, DEACTIVATED |
| `document_visibility` | PUBLIC, STUDENT_ONLY, FACULTY_ONLY, PRIVATE |
| `document_status` | DRAFT (default), SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, ARCHIVED |
| `document_permission` | VIEW, DOWNLOAD (DOWNLOAD implies VIEW at app layer) |
| `content_status` | DRAFT (default), SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, PUBLISHED, ARCHIVED — shared by stories, achievements, opportunities, department_history |
| `batch_status` | ACTIVE (default), ARCHIVED |

Core principle: **approval and visibility are separate columns.** Public
access requires both (e.g. `APPROVED + PUBLIC`); `APPROVED + STUDENT_ONLY`
is approved but member-only; `PRIVATE` means owner/authorized-only.

## Tables (19)

| Table | Purpose | Soft delete |
|---|---|---|
| `users` | App identity: auth link, email, role, status | No |
| `profiles` | 1:1 public/member profile + storage path refs | No |
| `profile_privacy` | 1:1 per-field visibility flags (safe defaults) | No |
| `batches` | Cohorts; `name` unique, `batch_number` not (history is irregular) | No (ARCHIVED status) |
| `student_profiles` | 1:1 student record, `student_id` unique, never public by default | No |
| `alumni_profiles` | 1:1 alumni record (company, designation, location…) | No |
| `work_experience` | N per user, ordered | No |
| `education` | N per user, ordered | No |
| `document_categories` | Seeded taxonomy (10 rows, stable slugs) | No (`is_active` flag) |
| `documents` | Archive items + storage metadata (provider/bucket/path, never URLs) | Yes (`deleted_at`) |
| `document_permissions` | Explicit VIEW/DOWNLOAD grants, optional expiry | No |
| `document_versions` | Immutable version history, `UNIQUE(document_id, version_number)` | No |
| `achievements` | Member achievements, evidence URL + image path | No |
| `stories` | Member stories, `UNIQUE(slug)` | No |
| `opportunities` | Member-only listings (no public flag; RLS in Phase 4) | No |
| `mentorship_profiles` | 1:1 mentor record (member-only; RLS in Phase 4) | No |
| `department_history` | Curated memory entries, ordered | No |
| `notifications` | Per-user inbox; `read_at` implies `is_read` | No |
| `audit_logs` | Append-only security trail (trigger-enforced) | No (never) |

Conventions: UUID PKs (`gen_random_uuid()`), `timestamptz` everywhere,
`created_at`/`updated_at` defaults of `now()`, emails normalized lowercase
(enforced by `CHECK`), URLs validated with a `^https?://` check, years
bounded to 1900–2100, non-empty checks on titles/paths/filenames.

## Key relationships & delete behavior (24 FKs)

- **Owned profile data → CASCADE:** profiles, profile_privacy,
  student/alumni profiles, work_experience, education, achievements,
  stories, opportunities, mentorship_profiles, notifications follow the user.
- **Archive preservation → RESTRICT:** `documents.owner_id`,
  `documents.category_id`, `document_permissions.granted_by`,
  `document_versions.uploaded_by` block deletion while referenced — removal
  requires an explicit admin process (transfer/revoke first).
- **History survives → SET NULL:** `student/alumni_profiles.batch_id`,
  `documents.batch_id`, `documents.approved_by`,
  `department_history.created_by`, `audit_logs.actor_id`.
- **Controlled document deletion → CASCADE:** deleting a document removes its
  versions and permission grants (permanent deletion is an explicit process;
  normal flow is soft delete via `deleted_at`).
- **No circular FKs.** Polymorphic refs (`notifications.entity_*`,
  `audit_logs.entity_id`) carry no FK by design.

## `updated_at` mechanism

Single reusable trigger `public.set_updated_at()` (`NEW.updated_at = now()`)
attached `BEFORE UPDATE` to all 15 mutable tables. Excluded:
`document_permissions` (revoke/re-issue, not edited), `document_versions`
(immutable), `notifications` (`read_at` tracks state), `audit_logs`
(append-only).

## `audit_logs` append-only rule

Trigger `audit_logs_no_update_delete` rejects every UPDATE/DELETE **except**
the FK-driven `actor_id → NULL` transition when a user is deleted (all other
columns must be identical). Verified: content edits, actor reassignment, and
deletes all raise; user deletion still succeeds with `actor_id = NULL`.

## Slug strategy

- `documents.slug`: partial unique index `WHERE deleted_at IS NULL` — a
  soft-deleted row never blocks slug reuse.
- `stories.slug`, `document_categories.slug`: plain `UNIQUE` (no soft
  delete on those tables).

## Search readiness (no redesign needed later)

- Plain `TEXT` columns (no `citext` lock-in); btree indexes on all specified
  filter columns (role, status, batch, year, company, designation, location,
  category, supervisor, dates).
- `GIN` indexes already in place: `documents.keywords`,
  `mentorship_profiles.areas`, `mentorship_profiles.preferred_topics`.
- Later phases can add `tsvector` columns + `pg_trgm` without touching this
  core model.

## Seed data

Only `document_categories` (10 rows, stable slugs, idempotent
`ON CONFLICT (slug) DO NOTHING`). No fake users, people, or documents.

## Migration strategy

- Forward-only Supabase-style files: `supabase/migrations/<timestamp>_*.sql`.
- Never edit an applied migration; fix forward with a new file.
- No RLS in the Phase 3 files; authorization lives in the Phase 4
  migrations (`2026091301000*_*.sql`) and is documented in
  `docs/security.md`. No buckets/storage objects (later phase).
- Validate with real PostgreSQL before merge (see Phase 3 report).
