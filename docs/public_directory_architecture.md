# Public Directory Architecture (Phase 8)

Privacy-aware public directory: alumni listing, public profiles, batch
browsing, and safe search/filtering.

> Raw profile tables are not the public API.

## 1. Public/private boundary

```
anonymous browser ──► public pages (server components) ──► PublicDirectoryService /
                      photo endpoint (route handler)        PublicBatchService
                                                              │
raw tables = protected ◄── RLS (unchanged)                    ▼
public views = controlled ◄── row + field gates in SQL   repository interfaces
public UI = projection only                              (Supabase impl)
```

Three layers, each independently safe: even if the UI asked for too much,
the service validates and returns DTOs; even if the service asked for too
much, the views only expose gated columns for eligible rows; even if the
views were bypassed, raw-table RLS denies anonymous access entirely.

## 2. Public profile DTO

`SafePublicProfile` (card/search rows) and `PublicProfileDetail` (detail
page = card + `work[]` + `education[]`), in `src/types/directory.ts`.

Present: slug, role kind, names, `hasPhoto` (boolean — never the path),
bio/location/email/phone/socials (each NULL unless its `show_*` flag is
on), headline career (company/designation always; work location gated by
`show_location`; summary gated by `show_career`), unified graduation year,
batch reference (id/name/years).

Absent by construction: `user_id`, auth/session/audit internals, photo
paths, `student_id`, academic status, semester, department, enrollment
year, mentorship data, work/education row ids, batch cover paths.

## 3. Privacy enforcement

Enforced in the DATABASE views (`20260913040001_public_directory.sql`),
all `security_barrier` owner-rights views granted to `anon` +
`authenticated`:

- Row gates (all three views): `users.status = 'ACTIVE'`,
  `role IN ('ALUMNI','STUDENT','FACULTY')` (staff never listed),
  `show_profile_publicly`, `profile_visibility = 'PUBLIC'`,
  `profile_slug IS NOT NULL`.
- Field gates: `CASE WHEN pp.show_*` per column. Email comes from the
  joined `users` row (gated by `show_email`); phone likewise.
- Career/education detail views add `show_career` / `show_education` and
  re-check every row gate independently — a list can never leak for a
  hidden profile even if queried directly.

Consequences: PENDING/SUSPENDED/DEACTIVATED accounts never appear;
unsetting any flag (or visibility, or the public opt-in) removes the
data on the very next read — there is no cache to invalidate (§9).

## 4. Directory search

`GET /alumni` (native form, zero client JS) → `searchPublicProfiles()`
→ one Tailored PostgREST query on `profiles_public`. Every filter
(name, batch, graduation year, company, designation, location, role)
applies INSIDE the database; fetch-then-filter in JS is forbidden by
contract (it would be a leak and a performance cliff).

Validation (`src/validations/directory.ts`, service-enforced): text
trimmed/collapsed, max 100 chars; pageSize 1–50 (default 20);
page ≥ 1 with an offset cap of 1000 (deep pages rejected, not
truncated); batch must be UUID; year 1900–2100; role from the directory
enum (ADMIN/MODERATOR rejected). LIKE metacharacters (`\`, `%`, `_`)
are escaped with values still parameterized; `*` keeps PostgREST's
native partial-match meaning (documented in code).

Pagination is stable (`ORDER BY full_name, slug`) and `total` counts
eligible rows only, so paging cannot reveal hidden rows.

Deliberately unsupported by the schema (reported, not fabricated):
industry, skills, and structured city/country. Location filtering is a
free-text substring over the gated `location` column.

## 5. Batch pages

Batch metadata is intentionally public reference data (pre-existing
`batches_select_public USING (true)` policy — no view needed; the
repository selects explicit safe columns, `cover_image_path` excluded).
`/batches` lists all batches; `/batches/[id]` shows metadata plus
paged PUBLIC members via the directory search with the batch pinned
server-side (callers cannot widen it). Raw membership records are never
exposed; batch administration remains admin-only (no write methods).

## 6. Public identifiers

`profiles.profile_slug`: server-generated (`name-a1b2c3`), UNIQUE,
stable for life, backfilled idempotently by `ensureInitialized`
(collision → fresh suffix, 3 attempts, graceful slugless fallback).
Slugs are the ONLY public identifier — public URLs (`/alumni/[slug]`),
DTOs, and searches never carry `user_id`, which was REMOVED from the
`profiles_public` output (Phase 4 exposed it). No user-chosen slugs
exist in this phase, so claiming/squatting attacks cannot occur.

Batch pages use batch UUIDs: unguessable reference keys (122-bit),
already public via the batches policy — documented, not hidden.

## 7. Profile photo delivery

The `profile-media` bucket stays PRIVATE. Photos render through
`GET /api/directory/photo/[slug]`: validate slug → public-view hit +
`hasPhoto` → privileged path lookup by slug → 302 to a 5-minute signed
URL (`private, no-store`). Malformed/hidden/photoless/error cases all
return bare 404s. The browser never sees storage paths (which embed
user IDs); the endpoint returns only `{ url, expiresAt }`. The
privileged path lookup is the single new privileged op (see
`docs/profile_architecture.md` §4) and is always gated on a view hit.

## 8. RLS assumptions

Zero changes to raw-table policies in this phase (verified by
migration text checks: no `CREATE POLICY`, no `SECURITY DEFINER` in the
new migration). The model relies on: raw tables denying anon;
owner-rights views projecting gated columns; grants on views only.
Any future policy change needs a versioned migration plus reasoning.

## 9. Caching behavior

Correctness over speed: all directory pages and the photo endpoint are
`force-dynamic` with no shared cache. A member going private
disappears on the next request; signed photo URLs live 5 minutes.
No `cache`/ISR/static generation touches directory data in this phase.

## 10. Anonymous access

Anonymous users receive only view-eligible rows through validated
services. They cannot enumerate user IDs (no `user_id` in views/DTOs/
URLs), read hidden fields (NULLed in SQL), discover private profiles
via search (DB-filtered) or guessed URLs (uniform 404s), bypass
visibility via pagination (eligible-only counts), or reach private
storage (signed-URL-only, eligibility-checked). The single generic
endpoint refuses arbitrary tables/columns/filters by construction
(fixed view, constant columns, validated values).

## 11. Authenticated access

Signed-in members hitting public pages see the SAME public projection
(the views grant `authenticated` identical rows). Member authentication
grants no extra public-profile access; the member directory
(`profiles_member` + `DirectoryProfileService.getMemberProfile`) stays
a separate, ACTIVE-gated seam with no UI in this phase.

## 12. Mentorship decision

Mentorship availability is NOT publicly exposed
(`available_for_mentoring` appears in no view/DTO). Per the phase
brief's default: mentorship is member-only, and the public directory
must not become a mentorship directory. Revisit only with an explicit
product decision + privacy flag.

## 13. Student decision

Students appear publicly only under the same explicit gates (ACTIVE +
opt-in + PUBLIC). Exposed student-safe fields are limited to batch +
(expected) graduation year; `student_id`, academic status, semester,
department, and enrollment year are withheld even though they exist.
The `/alumni` directory defaults to alumni with an explicit selector
for students/faculty.

## 14. Future integration points

- Custom/claimable slugs: needs reservation + ownership proof (not built).
- `pg_trgm` search indexes (reserved by the enum migration) + display-name
  search (currently full-name only via the `search_name` column).
- Per-batch public member counts (needs an aggregate — avoided N+1 here).
- Batch cover images (same photo-endpoint treatment as avatars).
- Member directory UI on `profiles_member` (authenticated seam ready).
- Rate limiting on search/photo endpoints (noted hardening).
- Serverless large-upload caveat carries over from the profile doc.
