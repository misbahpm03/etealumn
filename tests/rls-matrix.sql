-- Phase 10 runtime RLS/security matrix (Phase 10 §17–§21).
--
-- UNVERIFIED — NEVER EXECUTED. No live Supabase/Postgres exists in this
-- environment, so this script is a carefully written DRAFT, not a proven
-- suite. Before trusting a single result: run it against a NON-PRODUCTION
-- project, read every failure, and fix the script alongside the schema.
--
-- What it covers (PostgreSQL/PostgREST boundary, not Next.js rendering):
--   A. documents reads per persona (anon/pending/student/alumni/faculty/
--      moderator/admin)          → §18
--   B. documents_public projection                               → §15, §21
--   C. document_versions inheritance                             → §18
--   D. document_permissions scoping                              → §18
--   E. write denials + column revocation                         → §19
--   F. lifecycle trigger + version uniqueness (DB authority)     → §2, §3
--   G. public directory views (field gating, eligibility)        → §16, §21
--   H. projection column-absence checks (leakage by construction)→ §15, §16
--
-- NOT covered here (need the app/storage layer, not SQL):
--   - signed-URL mint/expiry behavior (§20.1, .2, .7) — exercise via the
--     download route with the personas below; gating is covered statically
--     by tests/archive-services.test.ts (URL counter stays 0 on denial).
--   - audit-log contents (§24) — covered statically in the service tests.
--
-- Usage (destructive to NOTHING — everything runs in one transaction and
-- rolls back; fixtures use synthetic @example.invalid identities only):
--   psql "$SUPABASE_DB_URL" -f tests/rls-matrix.sql
-- A clean run ends with: MATRIX RESULT: ALL CHECKS PASSED.
-- Any failure aborts with: MATRIX FAIL: <message>.
--
-- Impersonation mechanism: direct-DB sessions run as postgres (bypassing
-- RLS), so each persona block does SET ROLE <anon|authenticated> plus
-- SET request.jwt.claims = '{"sub":"<auth_user_id>"}'. auth.uid() reads
-- the GUC — no auth.users rows are needed (public.users.auth_user_id has
-- no FK by design).

BEGIN;

-- Assertion helper (temporary: vanishes with the session).
CREATE OR REPLACE FUNCTION pg_temp.check(ok boolean, msg text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT ok THEN
    RAISE EXCEPTION 'MATRIX FAIL: %', msg;
  END IF;
END;
$$;

-- =================================================================== setup ==
-- Personas (auth_user_id → users.id; emails are synthetic).
SET session_replication_role TO replica;
--
-- Fixture note: the lifecycle trigger only permits INSERT-as-DRAFT, so
-- fixtures are loaded with triggers disabled (superuser-only setting,
-- transaction-scoped, rolled back with everything else). The trigger
-- itself is tested for real in section F with triggers re-enabled.
INSERT INTO public.users (id, auth_user_id, email, role, status) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'matrix-pending@example.invalid', 'STUDENT', 'PENDING'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'matrix-student@example.invalid', 'STUDENT', 'ACTIVE'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'matrix-alumni@example.invalid', 'ALUMNI', 'ACTIVE'),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004', 'matrix-faculty@example.invalid', 'FACULTY', 'ACTIVE'),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000005', 'matrix-moderator@example.invalid', 'MODERATOR', 'ACTIVE'),
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000006', 'matrix-admin@example.invalid', 'ADMIN', 'ACTIVE');

INSERT INTO public.document_categories (id, name, slug, is_active, display_order) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'Matrix Category', 'matrix-category', true, 0);

-- Document matrix (id → owner / visibility / status; d10 is soft-deleted).
--   d01 student  PUBLIC       APPROVED
--   d02 student  STUDENT_ONLY APPROVED
--   d03 faculty  FACULTY_ONLY APPROVED
--   d04 student  PRIVATE      APPROVED   (+VIEW→alumni, +DOWNLOAD→faculty, +expired→moderator)
--   d05 student  PRIVATE      DRAFT
--   d06 alumni   PRIVATE      SUBMITTED
--   d07 student  STUDENT_ONLY UNDER_REVIEW
--   d08 student  PUBLIC       REJECTED
--   d09 student  PUBLIC       ARCHIVED
--   d10 student  PUBLIC       APPROVED   (deleted)
--   d11 alumni   PUBLIC       APPROVED   (private author → author_* NULL)
INSERT INTO public.documents
  (id, owner_id, category_id, title, slug, visibility, status, allow_download,
   storage_provider, storage_bucket, storage_path, original_filename, mime_type,
   file_size, submitted_at, deleted_at)
VALUES
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Matrix public', 'matrix-public', 'PUBLIC', 'APPROVED', true, 'supabase', 'academic-archive', 'm/01', 'm01.pdf', 'application/pdf', 10, now(), NULL),
  ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Matrix student-only', 'matrix-student-only', 'STUDENT_ONLY', 'APPROVED', true, 'supabase', 'academic-archive', 'm/02', 'm02.pdf', 'application/pdf', 10, now(), NULL),
  ('d0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'Matrix faculty-only', 'matrix-faculty-only', 'FACULTY_ONLY', 'APPROVED', true, 'supabase', 'academic-archive', 'm/03', 'm03.pdf', 'application/pdf', 10, now(), NULL),
  ('d0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Matrix private', 'matrix-private', 'PRIVATE', 'APPROVED', true, 'supabase', 'academic-archive', 'm/04', 'm04.pdf', 'application/pdf', 10, now(), NULL),
  ('d0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Matrix draft', 'matrix-draft', 'PRIVATE', 'DRAFT', true, 'supabase', 'academic-archive', 'm/05', 'm05.pdf', 'application/pdf', 10, NULL, NULL),
  ('d0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'Matrix submitted', 'matrix-submitted', 'PRIVATE', 'SUBMITTED', true, 'supabase', 'academic-archive', 'm/06', 'm06.pdf', 'application/pdf', 10, now(), NULL),
  ('d0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Matrix in review', 'matrix-in-review', 'STUDENT_ONLY', 'UNDER_REVIEW', true, 'supabase', 'academic-archive', 'm/07', 'm07.pdf', 'application/pdf', 10, now(), NULL),
  ('d0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Matrix rejected', 'matrix-rejected', 'PUBLIC', 'REJECTED', true, 'supabase', 'academic-archive', 'm/08', 'm08.pdf', 'application/pdf', 10, now(), NULL),
  ('d0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Matrix archived', 'matrix-archived', 'PUBLIC', 'ARCHIVED', true, 'supabase', 'academic-archive', 'm/09', 'm09.pdf', 'application/pdf', 10, now(), NULL),
  ('d0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Matrix deleted', 'matrix-deleted', 'PUBLIC', 'APPROVED', true, 'supabase', 'academic-archive', 'm/10', 'm10.pdf', 'application/pdf', 10, now(), now()),
  ('d0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'Matrix private-author', 'matrix-private-author', 'PUBLIC', 'APPROVED', true, 'supabase', 'academic-archive', 'm/11', 'm11.pdf', 'application/pdf', 10, now(), NULL);

-- One v1 per document (version-visibility mirror checks).
INSERT INTO public.document_versions
  (document_id, version_number, storage_provider, storage_bucket, storage_path,
   original_filename, mime_type, file_size, uploaded_by)
SELECT d.id, 1, 'supabase', 'academic-archive', 'm/' || right(d.id::text, 2),
  'v1.pdf', 'application/pdf', 10, d.owner_id
FROM public.documents d WHERE d.id::text LIKE 'd0000000-%';

-- Grants on d04: VIEW→alumni, DOWNLOAD→faculty, expired DOWNLOAD→moderator.
INSERT INTO public.document_permissions (document_id, user_id, permission, granted_by, expires_at) VALUES
  ('d0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000003', 'VIEW', 'b0000000-0000-4000-8000-000000000002', NULL),
  ('d0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000004', 'DOWNLOAD', 'b0000000-0000-4000-8000-000000000002', NULL),
  ('d0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000005', 'DOWNLOAD', 'b0000000-0000-4000-8000-000000000002', '2020-01-01T00:00:00Z');

-- Profiles for §21: student is publicly eligible with mixed field flags;
-- alumni opted out; moderator is staff (never listed); pending inactive.
INSERT INTO public.profiles
  (user_id, full_name, display_name, bio, phone, location, website_url, profile_slug, profile_visibility)
VALUES
  ('b0000000-0000-4000-8000-000000000002', 'Matrix Student', NULL, 'Student bio', '+8801000000002', 'Dhaka', 'https://example.invalid/s', 'matrix-student', 'PUBLIC'),
  ('b0000000-0000-4000-8000-000000000003', 'Matrix Alumni', NULL, 'Alumni bio', '+8801000000003', 'Dhaka', 'https://example.invalid/a', 'matrix-alumni', 'PUBLIC'),
  ('b0000000-0000-4000-8000-000000000005', 'Matrix Moderator', NULL, NULL, NULL, NULL, NULL, 'matrix-moderator', 'PUBLIC'),
  ('b0000000-0000-4000-8000-000000000001', 'Matrix Pending', NULL, NULL, NULL, NULL, NULL, 'matrix-pending', 'PUBLIC');
INSERT INTO public.profile_privacy
  (user_id, show_email, show_phone, show_location, show_bio, show_career, show_education, show_social_links, show_profile_publicly)
VALUES
  ('b0000000-0000-4000-8000-000000000002', false, true, false, true, true, false, false, true),
  ('b0000000-0000-4000-8000-000000000003', false, false, true, true, true, true, true, false),
  ('b0000000-0000-4000-8000-000000000005', false, false, true, true, true, true, true, true),
  ('b0000000-0000-4000-8000-000000000001', false, false, true, true, true, true, true, true);
INSERT INTO public.work_experience (user_id, company, designation) VALUES
  ('b0000000-0000-4000-8000-000000000002', 'Matrix Labs', 'Intern');
INSERT INTO public.education (user_id, institution, degree) VALUES
  ('b0000000-0000-4000-8000-000000000002', 'Matrix University', 'BSc');

RESET session_replication_role;

-- ============================================================ A. documents ==
-- Expected live-row counts: anon 2, pending 2, student 8, alumni 6,
-- faculty 5, moderator 6, admin 10.

SET ROLE anon;
SET request.jwt.claims = '{"role":"anon"}';
SELECT pg_temp.check((SELECT count(*) FROM public.documents WHERE id::text LIKE 'd0000000-%') = 2, 'anon sees exactly the 2 public approved docs');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.documents WHERE slug = 'matrix-private'), 'anon cannot read private docs');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.documents WHERE slug = 'matrix-student-only'), 'anon cannot read student-only docs');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.documents WHERE slug = 'matrix-draft'), 'anon cannot read drafts');

SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
SELECT pg_temp.check((SELECT count(*) FROM public.documents WHERE id::text LIKE 'd0000000-%') = 2, 'pending sees only public docs');

SET request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
SELECT pg_temp.check((SELECT count(*) FROM public.documents WHERE id::text LIKE 'd0000000-%') = 8, 'student sees 8 (own + public + student-only)');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.documents WHERE slug = 'matrix-faculty-only'), 'student cannot read faculty-only docs');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.documents WHERE slug = 'matrix-submitted'), 'student cannot read another user''s submitted doc');

SET request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';
SELECT pg_temp.check((SELECT count(*) FROM public.documents WHERE id::text LIKE 'd0000000-%') = 6, 'alumni sees 6 (own + public + student-only + granted private)');

SET request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';
SELECT pg_temp.check((SELECT count(*) FROM public.documents WHERE id::text LIKE 'd0000000-%') = 5, 'faculty sees 5 (own + public + faculty-only + granted private)');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.documents WHERE slug = 'matrix-student-only'), 'faculty cannot read student-only docs');

SET request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000005","role":"authenticated"}';
SELECT pg_temp.check((SELECT count(*) FROM public.documents WHERE id::text LIKE 'd0000000-%') = 6, 'moderator sees 6 (public + faculty-only + in-review)');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.documents WHERE slug = 'matrix-private'), 'moderator cannot read approved PRIVATE docs (expired grant grants nothing)');
SELECT pg_temp.check((SELECT count(*) FROM public.documents WHERE slug IN ('matrix-submitted', 'matrix-in-review')) = 2, 'moderator reads in-review docs of any visibility');

SET request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000006","role":"authenticated"}';
SELECT pg_temp.check((SELECT count(*) FROM public.documents WHERE id::text LIKE 'd0000000-%') = 10, 'admin sees all 10 live docs');

-- ==================================================== B. public projection ==
SET ROLE anon;
SET request.jwt.claims = '{"role":"anon"}';
SELECT pg_temp.check((SELECT count(*) FROM public.documents_public WHERE slug LIKE 'matrix-%') = 2, 'projection holds exactly the 2 public approved docs');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.documents_public WHERE slug = 'matrix-rejected'), 'rejected docs excluded');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.documents_public WHERE slug = 'matrix-archived'), 'archived docs excluded');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.documents_public WHERE slug = 'matrix-deleted'), 'deleted docs excluded');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.documents_public WHERE slug = 'matrix-private'), 'private docs excluded');
SELECT pg_temp.check((SELECT author_name FROM public.documents_public WHERE slug = 'matrix-public') IS NOT NULL, 'eligible author resolves');
SELECT pg_temp.check((SELECT author_name FROM public.documents_public WHERE slug = 'matrix-private-author') IS NULL, 'private author stays NULL (name)');
SELECT pg_temp.check((SELECT author_slug FROM public.documents_public WHERE slug = 'matrix-private-author') IS NULL, 'private author stays NULL (slug)');

-- ============================================================== C. versions ==
-- Versions inherit document access exactly (same function, same counts).
SET request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
SET ROLE authenticated;
SELECT pg_temp.check((SELECT count(*) FROM public.document_versions v JOIN public.documents d ON d.id = v.document_id WHERE d.id::text LIKE 'd0000000-%') = 8, 'student sees 8 version rows');
SET ROLE anon;
SET request.jwt.claims = '{"role":"anon"}';
SELECT pg_temp.check((SELECT count(*) FROM public.document_versions v JOIN public.documents d ON d.id = v.document_id WHERE d.id::text LIKE 'd0000000-%') = 2, 'anon sees 2 version rows');

-- ========================================================== D. permissions ==
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
SELECT pg_temp.check((SELECT count(*) FROM public.document_permissions WHERE document_id::text LIKE 'd0000000-%') = 3, 'owner sees all 3 grants on own doc');
SET request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';
SELECT pg_temp.check((SELECT count(*) FROM public.document_permissions WHERE document_id::text LIKE 'd0000000-%') = 1, 'recipient sees own grant only');
SET request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000005","role":"authenticated"}';
SELECT pg_temp.check((SELECT count(*) FROM public.document_permissions WHERE document_id::text LIKE 'd0000000-%') = 0, 'moderator sees no grants');
SET request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000006","role":"authenticated"}';
SELECT pg_temp.check((SELECT count(*) FROM public.document_permissions WHERE document_id::text LIKE 'd0000000-%') = 3, 'admin sees all grants');
-- Anon has no SELECT grant on permissions at all: hard error, not 0 rows.
SET ROLE anon;
SET request.jwt.claims = '{"role":"anon"}';
DO $$ BEGIN
  BEGIN
    PERFORM 1 FROM public.document_permissions LIMIT 1;
    RAISE EXCEPTION 'MATRIX FAIL: anon permission read should error';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- ======================================================== E. write denials ==
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
-- Cross-user update: RLS USING matches nothing → 0 rows (silent deny).
SELECT pg_temp.check((WITH u AS (
  UPDATE public.documents SET title = 'hijacked'
  WHERE id = 'd0000000-0000-4000-8000-000000000006' RETURNING 1
) SELECT count(*) FROM u) = 0, 'cross-user update touches 0 rows');
-- Ownership forgery on insert: WITH CHECK fails → 42501.
DO $$ BEGIN
  BEGIN
    INSERT INTO public.documents (owner_id, category_id, title, slug, storage_provider, storage_bucket, storage_path, original_filename, mime_type, file_size)
    VALUES ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'Forgery', 'matrix-forgery', 'supabase', 'academic-archive', 'm/x', 'x.pdf', 'application/pdf', 1);
    RAISE EXCEPTION 'MATRIX FAIL: forged-owner insert should fail';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
-- Direct status manipulation: column revoked from UPDATE → 42501.
DO $$ BEGIN
  BEGIN
    UPDATE public.documents SET status = 'APPROVED' WHERE id = 'd0000000-0000-4000-8000-000000000005';
    RAISE EXCEPTION 'MATRIX FAIL: direct status write should fail';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
-- Self-grant / any grant by direct SQL: no INSERT policy → 42501.
DO $$ BEGIN
  BEGIN
    INSERT INTO public.document_permissions (document_id, user_id, permission, granted_by)
    VALUES ('d0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002', 'DOWNLOAD', 'b0000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'MATRIX FAIL: direct grant should fail';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
-- Historical version deletion: no DELETE policy → 0 rows.
SELECT pg_temp.check((WITH d AS (
  DELETE FROM public.document_versions WHERE document_id = 'd0000000-0000-4000-8000-000000000001' RETURNING 1
) SELECT count(*) FROM d) = 0, 'version delete touches 0 rows');

-- ================================= F. trigger + uniqueness (DB authority) ==
RESET ROLE; -- postgres bypasses RLS; triggers/constraints still fire.
DO $$ BEGIN
  BEGIN
    INSERT INTO public.documents (owner_id, category_id, title, slug, status, storage_provider, storage_bucket, storage_path, original_filename, mime_type, file_size)
    VALUES ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Bad birth', 'matrix-bad-birth', 'APPROVED', 'supabase', 'academic-archive', 'm/x', 'x.pdf', 'application/pdf', 1);
    RAISE EXCEPTION 'MATRIX FAIL: non-DRAFT insert should fail';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
DO $$ BEGIN
  BEGIN
    UPDATE public.documents SET status = 'APPROVED' WHERE id = 'd0000000-0000-4000-8000-000000000005';
    RAISE EXCEPTION 'MATRIX FAIL: DRAFT→APPROVED jump should fail';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.document_versions (document_id, version_number, storage_provider, storage_bucket, storage_path, original_filename, mime_type, file_size, uploaded_by)
    VALUES ('d0000000-0000-4000-8000-000000000001', 1, 'supabase', 'academic-archive', 'm/dup', 'dup.pdf', 'application/pdf', 1, 'b0000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'MATRIX FAIL: duplicate version should fail';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;
SELECT pg_temp.check((WITH u AS (
  UPDATE public.documents SET status = 'SUBMITTED' WHERE id = 'd0000000-0000-4000-8000-000000000005' RETURNING 1
) SELECT count(*) FROM u) = 1, 'legal DRAFT→SUBMITTED edge passes the trigger');

-- ================================================== G. public directory §21 ==
SET ROLE anon;
SET request.jwt.claims = '{"role":"anon"}';
SELECT pg_temp.check((SELECT count(*) FROM public.profiles_public WHERE slug LIKE 'matrix-%') = 1, 'exactly the eligible profile is listed');
SELECT pg_temp.check((SELECT email FROM public.profiles_public WHERE slug = 'matrix-student') IS NULL, 'hidden email is NULL');
SELECT pg_temp.check((SELECT phone FROM public.profiles_public WHERE slug = 'matrix-student') = '+8801000000002', 'shown phone is present');
SELECT pg_temp.check((SELECT location FROM public.profiles_public WHERE slug = 'matrix-student') IS NULL, 'hidden location is NULL');
SELECT pg_temp.check((SELECT bio FROM public.profiles_public WHERE slug = 'matrix-student') = 'Student bio', 'shown bio is present');
SELECT pg_temp.check((SELECT website_url FROM public.profiles_public WHERE slug = 'matrix-student') IS NULL, 'hidden socials are NULL');
SELECT pg_temp.check((SELECT count(*) FROM public.work_experience_public WHERE slug = 'matrix-student') = 1, 'opted-in career row is present');
SELECT pg_temp.check((SELECT count(*) FROM public.education_public WHERE slug = 'matrix-student') = 0, 'opted-out education rows disappear');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.profiles_public WHERE slug = 'matrix-moderator'), 'staff never listed');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM public.profiles_public WHERE slug = 'matrix-pending'), 'inactive accounts disappear');

-- ============================================= H. column-absence (no leaks) ==
SELECT pg_temp.check(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'documents_public'
    AND column_name IN ('owner_id', 'user_id', 'storage_path', 'storage_bucket', 'approved_by', 'approved_at', 'submitted_at', 'email', 'phone')
), 'documents_public has no owner/storage/approval/contact columns');
SELECT pg_temp.check(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles_public'
    AND column_name IN ('user_id', 'profile_photo_path')
), 'profiles_public has no raw ids or photo paths');

RESET ROLE;
RESET request.jwt.claims;
ROLLBACK;

-- If execution reaches here, every check passed (any failure aborts above).
DO $$ BEGIN
  RAISE NOTICE 'MATRIX RESULT: ALL CHECKS PASSED';
END $$;
