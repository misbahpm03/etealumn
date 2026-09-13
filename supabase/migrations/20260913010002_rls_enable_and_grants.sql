-- Phase 4: enable RLS everywhere + least-privilege grants.
--
-- Two independent layers: GRANTs decide which operations a role may attempt
-- at all (including per-column write lists), RLS policies decide which rows
-- each attempt may touch. Sensitive lifecycle columns (status, approvals,
-- ownership, visibility, storage pointers) are revoked from direct writes for
-- EVERYONE including admins — those mutations go through audited server-side
-- operations (service role bypasses RLS by design and must only be used in
-- controlled server code, never exposed to browsers).
--
-- `anon` receives SELECT only, and only on tables with a public audience.
-- `authenticated` receives SELECT broadly (policies restrict rows) plus
-- narrow write lists for owner-managed content.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_privacy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumni_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentorship_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Start from zero, then grant precisely. (Fresh Supabase tables already grant
-- nothing to these roles; this makes the posture explicit and portable.)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- ---------------------------------------------------------------- anon ----
-- SELECT only, restricted to tables with a genuinely public audience.
GRANT SELECT ON public.batches TO anon;
GRANT SELECT ON public.document_categories TO anon;
GRANT SELECT ON public.documents TO anon;
GRANT SELECT ON public.document_versions TO anon;
GRANT SELECT ON public.achievements TO anon;
GRANT SELECT ON public.stories TO anon;
GRANT SELECT ON public.department_history TO anon;

-- -------------------------------------------------------- authenticated ----
-- Identity / profile tables.
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT,
  INSERT (user_id, full_name, display_name, profile_photo_path, bio, phone, location, website_url, linkedin_url, facebook_url, github_url, profile_visibility),
  UPDATE (full_name, display_name, profile_photo_path, bio, phone, location, website_url, linkedin_url, facebook_url, github_url, profile_visibility)
  ON public.profiles TO authenticated;
GRANT SELECT,
  INSERT (user_id, show_email, show_phone, show_location, show_bio, show_career, show_education, show_social_links, show_profile_publicly),
  UPDATE (show_email, show_phone, show_location, show_bio, show_career, show_education, show_social_links, show_profile_publicly)
  ON public.profile_privacy TO authenticated;

-- Reference / academic-identity tables: reads only, plus two harmless
-- self-service columns. Creation, batch assignment, student ids, and year
-- data are admin-verified and go through server-side flows.
GRANT SELECT ON public.batches TO authenticated;
GRANT SELECT, UPDATE (current_semester, department)
  ON public.student_profiles TO authenticated;
GRANT SELECT, UPDATE (current_company, current_designation, current_location, career_summary, available_for_mentoring)
  ON public.alumni_profiles TO authenticated;
GRANT SELECT,
  INSERT (user_id, company, designation, location, start_date, end_date, is_current, description, display_order),
  UPDATE (company, designation, location, start_date, end_date, is_current, description, display_order),
  DELETE ON public.work_experience TO authenticated;
GRANT SELECT,
  INSERT (user_id, institution, degree, field_of_study, start_year, end_year, description, display_order),
  UPDATE (institution, degree, field_of_study, start_year, end_year, description, display_order),
  DELETE ON public.education TO authenticated;

-- Archive tables. Lifecycle columns (status, visibility changes, approvals,
-- storage pointers, soft delete) are revoked: draft creation/editing is
-- direct, every transition is an audited server-side operation.
GRANT SELECT ON public.document_categories TO authenticated;
GRANT SELECT,
  INSERT (owner_id, batch_id, category_id, title, slug, description, abstract, year, supervisor_name, keywords, visibility, allow_download, storage_provider, storage_bucket, storage_path, original_filename, mime_type, file_size),
  UPDATE (title, slug, description, abstract, year, supervisor_name, keywords, category_id, batch_id, allow_download)
  ON public.documents TO authenticated;
GRANT SELECT ON public.document_permissions TO authenticated;
GRANT SELECT ON public.document_versions TO authenticated;

-- Content tables. Status/publication columns revoked: owners draft directly,
-- moderation transitions go through audited server-side operations.
GRANT SELECT,
  INSERT (user_id, title, description, category, organization, achievement_date, evidence_url, image_path),
  UPDATE (title, description, category, organization, achievement_date, evidence_url, image_path),
  DELETE ON public.achievements TO authenticated;
GRANT SELECT,
  INSERT (author_id, title, slug, excerpt, content, cover_image_path),
  UPDATE (title, slug, excerpt, content, cover_image_path),
  DELETE ON public.stories TO authenticated;
GRANT SELECT,
  INSERT (posted_by, title, organization, description, category, location, application_url, deadline),
  UPDATE (title, organization, description, category, location, application_url, deadline),
  DELETE ON public.opportunities TO authenticated;
GRANT SELECT,
  INSERT (user_id, is_available, areas, experience, preferred_topics, contact_preference),
  UPDATE (is_available, areas, experience, preferred_topics, contact_preference),
  DELETE ON public.mentorship_profiles TO authenticated;
GRANT SELECT ON public.department_history TO authenticated;

-- Activity tables.
GRANT SELECT, UPDATE (is_read, read_at) ON public.notifications TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
