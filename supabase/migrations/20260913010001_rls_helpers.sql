-- Phase 4: authorization helper functions for RLS.
--
-- Identity always derives from `auth.uid()` (the JWT subject) joined to
-- `public.users.auth_user_id`. Nothing here trusts request input, and a
-- missing application-user record yields NULL, which denies access by default.
--
-- All helpers are SECURITY DEFINER with a fixed `search_path`. This is
-- required (not a shortcut): RLS policies on `public.users` itself must test
-- the caller's role, and any invoker-rights query against `users` from a
-- `users` policy would recurse infinitely. As table-owner functions they read
-- only the caller's own user row through a fixed `auth.uid()` predicate — no
-- parameters that select other users, no dynamic SQL, no writes. EXECUTE is
-- intentionally left granted to anon/authenticated because policies evaluated
-- as those roles must be able to call them; the functions leak nothing beyond
-- the caller's own identity, which the caller already has.
--
-- Convention: EVERY role helper implies `status = 'ACTIVE'`. There is no way
-- to hold a "role privilege" while PENDING, SUSPENDED, or DEACTIVATED —
-- including for admins (no emergency backdoor in Phase 4).

-- Caller's application-user id, or NULL when signed out / unprovisioned.
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE auth_user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_status()
RETURNS public.user_status
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status FROM public.users WHERE auth_user_id = auth.uid()
$$;

-- Gate for all normal member privileges.
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid() AND status = 'ACTIVE'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid() AND status = 'ACTIVE' AND role = 'ADMIN'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid() AND status = 'ACTIVE' AND role = 'MODERATOR'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_faculty()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid() AND status = 'ACTIVE' AND role = 'FACULTY'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_student()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid() AND status = 'ACTIVE' AND role = 'STUDENT'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_alumni()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid() AND status = 'ACTIVE' AND role = 'ALUMNI'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_student_or_alumni()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid() AND status = 'ACTIVE'
      AND role IN ('STUDENT', 'ALUMNI')
  )
$$;

-- Moderators and admins (active). Used for review queues and staff-only reads.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid() AND status = 'ACTIVE'
      AND role IN ('MODERATOR', 'ADMIN')
  )
$$;

-- True when the caller owns the given document. Definer-rights so the
-- `document_permissions` policy can test ownership without recursing back
-- through the `documents` policy (documents -> permissions -> documents would
-- otherwise loop forever).
CREATE OR REPLACE FUNCTION public.owns_document(doc_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.users u ON u.id = d.owner_id
    WHERE d.id = doc_id AND u.auth_user_id = auth.uid()
  )
$$;

-- Single source of truth for "may the caller read this document". Used by the
-- `documents` and `document_versions` SELECT policies (and designed for reuse
-- by Phase 5 storage policies). Definer-rights: it must evaluate grants and
-- ownership without re-entering RLS, which also keeps versions from ever
-- bypassing document visibility.
--
-- Granted exactly when the document is live AND one of:
--   owner (any status) | APPROVED+PUBLIC (everyone) |
--   APPROVED+STUDENT_ONLY (active students/alumni) |
--   APPROVED+FACULTY_ONLY (active faculty/moderators/admins) |
--   SUBMITTED/UNDER_REVIEW (active moderators/admins, for review queues) |
--   unexpired explicit grant to an active user | active admin.
CREATE OR REPLACE FUNCTION public.can_access_document(doc_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    WITH viewer AS (
      SELECT id, role, status FROM public.users WHERE auth_user_id = auth.uid()
    )
    SELECT 1
    FROM public.documents d
    LEFT JOIN viewer v ON true
    LEFT JOIN public.document_permissions dp
      ON dp.document_id = d.id
     AND dp.user_id = v.id
     AND (dp.expires_at IS NULL OR dp.expires_at > now())
    WHERE d.id = doc_id
      AND d.deleted_at IS NULL
      AND (
        d.owner_id = v.id
        OR (d.status = 'APPROVED' AND d.visibility = 'PUBLIC')
        OR (d.status = 'APPROVED' AND d.visibility = 'STUDENT_ONLY'
            AND v.status = 'ACTIVE' AND v.role IN ('STUDENT', 'ALUMNI'))
        OR (d.status = 'APPROVED' AND d.visibility = 'FACULTY_ONLY'
            AND v.status = 'ACTIVE' AND v.role IN ('FACULTY', 'MODERATOR', 'ADMIN'))
        OR (d.status IN ('SUBMITTED', 'UNDER_REVIEW')
            AND v.status = 'ACTIVE' AND v.role IN ('MODERATOR', 'ADMIN'))
        OR (dp.user_id IS NOT NULL AND v.status = 'ACTIVE')
        OR (v.status = 'ACTIVE' AND v.role = 'ADMIN')
      )
  )
$$;
