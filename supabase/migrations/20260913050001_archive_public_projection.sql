-- Phase 9: public archive projection.
--
-- SECURITY MODEL (same philosophy as Phase 8's directory views):
--
--   raw tables = protected (existing RLS untouched by this migration)
--   public view  = controlled projection (this migration)
--   public UI    = projection only (never raw `documents` rows)
--
-- Raw `documents` rows carry owner_id, storage paths, approval metadata,
-- and permission-adjacent state — anonymous clients must never select them
-- directly for display, even though `can_access_document()` would permit
-- APPROVED+PUBLIC reads. This owner-rights view projects ONLY public-safe
-- columns for live APPROVED+PUBLIC rows. `security_barrier` keeps caller
-- predicates from being pushed below the projection.
--
-- Deliberately NEVER exposed here: document/owner/category/batch ids,
-- storage provider/bucket/path, filenames, MIME/size, submitted/approved
-- timestamps, approver ids, permission records, deleted rows (excluded),
-- and non-APPROVED statuses. Author identity resolves through the SAME
-- public-profile gates as Phase 8 (mirrored predicates, not a join on the
-- slug-keyed view): when the owner's profile is not publicly eligible,
-- author fields are NULL rather than leaking private profile data.
--
-- No other migration needs: version uniqueness already exists
-- (`document_versions_unique_version`), slug partial-uniqueness exists,
-- and the §21 moderator-RLS review concluded the current policies are
-- intentionally scoped (see docs/academic_archive_architecture.md).

CREATE VIEW public.documents_public WITH (security_barrier = true) AS
SELECT
  d.slug AS slug,
  d.title AS title,
  d.description AS description,
  d.abstract AS abstract,
  d.year AS year,
  d.supervisor_name AS supervisor_name,
  d.keywords AS keywords,
  d.allow_download AS allow_download,
  c.name AS category_name,
  c.slug AS category_slug,
  b.name AS batch_name,
  b.admission_year AS batch_admission_year,
  b.graduation_year AS batch_graduation_year,
  -- Privacy-aware author: name/slug only when the owner is publicly
  -- eligible (ACTIVE + non-staff role + opt-in + PUBLIC + slug present).
  CASE
    WHEN u.id IS NOT NULL
      AND pp.user_id IS NOT NULL
      AND p.profile_visibility = 'PUBLIC'
      AND p.profile_slug IS NOT NULL
    THEN COALESCE(p.display_name, p.full_name)
  END AS author_name,
  CASE
    WHEN u.id IS NOT NULL
      AND pp.user_id IS NOT NULL
      AND p.profile_visibility = 'PUBLIC'
      AND p.profile_slug IS NOT NULL
    THEN p.profile_slug
  END AS author_slug
FROM public.documents d
JOIN public.document_categories c ON c.id = d.category_id
LEFT JOIN public.batches b ON b.id = d.batch_id
LEFT JOIN public.users u
  ON u.id = d.owner_id
  AND u.status = 'ACTIVE'
  AND u.role IN ('ALUMNI', 'STUDENT', 'FACULTY')
LEFT JOIN public.profile_privacy pp
  ON pp.user_id = d.owner_id
  AND pp.show_profile_publicly
LEFT JOIN public.profiles p ON p.user_id = d.owner_id
WHERE d.status = 'APPROVED'
  AND d.visibility = 'PUBLIC'
  AND d.deleted_at IS NULL;

GRANT SELECT ON public.documents_public TO anon, authenticated;

COMMENT ON VIEW public.documents_public IS
  'Phase 9 public archive projection. Live APPROVED+PUBLIC rows only; '
  'no ids, no storage metadata, no approval internals; author gated on '
  'public-profile eligibility (NULL when the owner profile is private).';
