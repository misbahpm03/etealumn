-- Phase 8: public directory projection.
--
-- SECURITY MODEL (read before touching this file):
--
--   raw tables = protected (existing RLS untouched by this migration)
--   public views = controlled projection (this migration)
--   public UI   = projection only (never raw tables)
--
-- These are owner-rights views (like Phase 4's 10006): the view owner can
-- read the base tables, and anon/authenticated get SELECT on the VIEWS ONLY.
-- Privacy is enforced INSIDE each view (row gates in WHERE, field gates via
-- CASE), so callers structurally cannot bypass it. `security_barrier` keeps
-- caller predicates from being pushed below the projection.
--
-- Deliberately NEVER exposed here: user_id (see slug decision below),
-- profile_photo_path (resolved server-side only, §photo), phone/email except
-- behind their explicit opt-in flags, student_id, academic_status, semester,
-- department, enrollment_year, available_for_mentoring (mentorship is
-- member-only; public availability display defaulted to OFF, see
-- docs/public_directory_architecture.md), auth/session/audit internals, and
-- work/education row ids.
--
-- PUBLIC IDENTIFIER: `profiles.profile_slug` (server-generated, UNIQUE,
-- never user-editable in this phase). Public URLs, DTOs, and searches are
-- keyed by slug — never by user_id. Dropping user_id from the public view
-- output (it was present in Phase 4) means anonymous clients cannot harvest
-- raw user IDs from the raw view, and photo paths (which embed user_id) are
-- likewise withheld: photo delivery goes through a server endpoint that
-- verifies public eligibility via this view and then signs short-lived URLs.

-- 1. Slug column. NULL-able: existing rows are preserved untouched, and the
-- app backfills slugs idempotently (UNIQUE treats NULLs as distinct, so no
-- partial index is needed). Public views require slug IS NOT NULL, so a
-- slugless profile can never appear publicly.
ALTER TABLE public.profiles ADD COLUMN profile_slug text UNIQUE NULL;

COMMENT ON COLUMN public.profiles.profile_slug IS
  'Server-generated unique public handle (Phase 8). NULL until backfilled; '
  'public views exclude NULL slugs. Never user-editable; no claim path exists.';

-- 2. profiles_public: rebuilt WITHOUT user_id / profile_photo_path, WITH the
-- directory fields Phase 8 needs. DROP+CREATE (not OR REPLACE) because the
-- column list changes; grants are re-applied below.
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public WITH (security_barrier = true) AS
SELECT
  p.profile_slug AS slug,
  u.role AS role,
  p.full_name AS full_name,
  p.display_name AS display_name,
  -- Directory cards need to know whether to render an <img>; the actual path
  -- stays server-side (photo endpoint resolves + signs it).
  (p.profile_photo_path IS NOT NULL) AS has_photo,
  -- Single-column name search (full + display); never selected by the UI.
  (p.full_name || ' ' || COALESCE(p.display_name, '')) AS search_name,
  CASE WHEN pp.show_bio THEN p.bio END AS bio,
  CASE WHEN pp.show_location THEN p.location END AS location,
  -- Explicit opt-in contact fields (Phase 8 requirement; Phase 4 omitted
  -- email entirely — now gated behind show_email instead of absent).
  CASE WHEN pp.show_email THEN u.email END AS email,
  CASE WHEN pp.show_phone THEN p.phone END AS phone,
  CASE WHEN pp.show_social_links THEN p.website_url END AS website_url,
  CASE WHEN pp.show_social_links THEN p.linkedin_url END AS linkedin_url,
  CASE WHEN pp.show_social_links THEN p.facebook_url END AS facebook_url,
  CASE WHEN pp.show_social_links THEN p.github_url END AS github_url,
  -- Headline career: public whenever the profile is public.
  a.current_company AS current_company,
  a.current_designation AS current_designation,
  CASE WHEN pp.show_location THEN a.current_location END AS work_location,
  CASE WHEN pp.show_career THEN a.career_summary END AS career_summary,
  -- Unified graduation year (alumni actual / student expected).
  COALESCE(a.graduation_year, s.expected_graduation_year) AS graduation_year,
  -- Batch linkage (either role row); reference data, publicly joinable.
  COALESCE(a.batch_id, s.batch_id) AS batch_id,
  b.name AS batch_name,
  b.admission_year AS batch_admission_year,
  b.graduation_year AS batch_graduation_year
FROM public.profiles p
JOIN public.profile_privacy pp ON pp.user_id = p.user_id
JOIN public.users u ON u.id = p.user_id
LEFT JOIN public.alumni_profiles a ON a.user_id = p.user_id
LEFT JOIN public.student_profiles s ON s.user_id = p.user_id
LEFT JOIN public.batches b ON b.id = COALESCE(a.batch_id, s.batch_id)
WHERE u.status = 'ACTIVE'
  -- Staff roles are never directory members, even if misconfigured public.
  AND u.role IN ('ALUMNI', 'STUDENT', 'FACULTY')
  AND pp.show_profile_publicly
  AND p.profile_visibility = 'PUBLIC'
  AND p.profile_slug IS NOT NULL;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

COMMENT ON VIEW public.profiles_public IS
  'Phase 8 public directory projection. Row gates: ACTIVE + non-staff role + '
  'show_profile_publicly + PUBLIC visibility + slug present. Field gates via '
  'CASE on show_* flags. No user_id, no photo path, no student internals.';

-- 3. Public career detail: work rows whose owner is publicly eligible AND
-- opted into career display. Keyed by slug; no row/user ids exposed.
CREATE VIEW public.work_experience_public WITH (security_barrier = true) AS
SELECT
  p.profile_slug AS slug,
  w.company AS company,
  w.designation AS designation,
  w.location AS location,
  w.start_date AS start_date,
  w.end_date AS end_date,
  w.is_current AS is_current,
  w.description AS description,
  w.display_order AS display_order
FROM public.work_experience w
JOIN public.profiles p ON p.user_id = w.user_id
JOIN public.profile_privacy pp ON pp.user_id = w.user_id
JOIN public.users u ON u.id = w.user_id
WHERE u.status = 'ACTIVE'
  AND u.role IN ('ALUMNI', 'STUDENT', 'FACULTY')
  AND pp.show_profile_publicly
  AND p.profile_visibility = 'PUBLIC'
  AND p.profile_slug IS NOT NULL
  AND pp.show_career;

GRANT SELECT ON public.work_experience_public TO anon, authenticated;

-- 4. Public education detail: same posture, gated on show_education.
CREATE VIEW public.education_public WITH (security_barrier = true) AS
SELECT
  p.profile_slug AS slug,
  e.institution AS institution,
  e.degree AS degree,
  e.field_of_study AS field_of_study,
  e.start_year AS start_year,
  e.end_year AS end_year,
  e.description AS description,
  e.display_order AS display_order
FROM public.education e
JOIN public.profiles p ON p.user_id = e.user_id
JOIN public.profile_privacy pp ON pp.user_id = e.user_id
JOIN public.users u ON u.id = e.user_id
WHERE u.status = 'ACTIVE'
  AND u.role IN ('ALUMNI', 'STUDENT', 'FACULTY')
  AND pp.show_profile_publicly
  AND p.profile_visibility = 'PUBLIC'
  AND p.profile_slug IS NOT NULL
  AND pp.show_education;

GRANT SELECT ON public.education_public TO anon, authenticated;

-- 5. Batches need NO new view: `batches_select_public USING (true)` already
-- makes batch reference data publicly readable by deliberate Phase 4 design.
-- The repository selects explicit safe columns (cover_image_path excluded).
--
-- 6. Search indexes: out of scope for this migration. The enum migration
-- (00001) reserves `pg_trgm` for the later search-index phase; until then,
-- ILIKE scans the (small) public-projected row set. Existing btree indexes
-- on alumni company/designation/graduation_year and batch ids cover the
-- equality filters underneath the views.
