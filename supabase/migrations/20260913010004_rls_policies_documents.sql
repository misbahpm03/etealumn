-- Phase 4: RLS policies for the document archive.
--
-- Read access has ONE source of truth: `can_access_document()` (defined in
-- 10001), used by both `documents` and `document_versions` so versions can
-- never bypass document visibility. Approval and visibility stay independent:
-- every audience branch requires APPROVED *and* its visibility, plus a live
-- (non-deleted) row.
--
-- Write strategy (lifecycle protection): owners draft directly (INSERT +
-- DRAFT/REJECTED-only UPDATE of safe columns — sensitive columns are revoked
-- by GRANT). Every transition (submit, approve, reject, publish, visibility
-- change, soft delete, restore, grant management, versioning) is an audited
-- server-side operation. Direct SQL cannot self-approve, impersonate owners,
-- forge approvals, or self-grant access.

-- Reference data: active categories readable by everyone (including anon);
-- inactive ones visible to staff for curation. All writes server-side.
CREATE POLICY document_categories_select ON public.document_categories
  FOR SELECT TO PUBLIC
  USING (is_active = true OR public.is_staff());

CREATE POLICY documents_select ON public.documents
  FOR SELECT TO PUBLIC
  USING (public.can_access_document(id));

CREATE POLICY documents_insert_own_draft ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user()
    AND owner_id = public.current_app_user_id()
    AND approved_by IS NULL
    AND approved_at IS NULL
    AND submitted_at IS NULL
    AND deleted_at IS NULL
  );

CREATE POLICY documents_update_own_draft_or_rejected ON public.documents
  FOR UPDATE TO authenticated
  USING (
    public.is_active_user()
    AND owner_id = public.current_app_user_id()
    AND status IN ('DRAFT', 'REJECTED')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    public.is_active_user()
    AND owner_id = public.current_app_user_id()
    AND status IN ('DRAFT', 'REJECTED')
    AND deleted_at IS NULL
  );

-- No DELETE policy: soft delete is an audited server-side operation and hard
-- delete is an explicit admin process (which cascades versions/permissions).

-- Permission records are sensitive: recipients read their own grants, owners
-- read grants on their own documents (via definer `owns_document`, avoiding a
-- documents -> permissions -> documents recursion), admins read all. Grants
-- can never be created, altered, or revoked by direct SQL — `granted_by`
-- impersonation and self-grants are structurally impossible.
CREATE POLICY document_permissions_select ON public.document_permissions
  FOR SELECT TO authenticated
  USING (
    user_id = public.current_app_user_id()
    OR public.owns_document(document_id)
    OR public.is_admin()
  );

-- Versions inherit document access exactly — same function, same result.
CREATE POLICY document_versions_select ON public.document_versions
  FOR SELECT TO PUBLIC
  USING (public.can_access_document(document_id));
