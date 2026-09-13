-- Phase 4: RLS policies for content, mentorship, history, and activity tables.
--
-- Same lifecycle strategy as documents: owners draft directly (safe columns
-- only — status/publication columns are revoked by GRANT, so direct SQL
-- cannot self-publish or self-approve); moderation transitions are audited
-- server-side operations. Staff see review queues (SUBMITTED/UNDER_REVIEW);
-- admins read everything.

-- achievements / stories: owner sees own any-status; PUBLISHED is public;
-- review queue for staff; blanket for admins.
CREATE POLICY achievements_select ON public.achievements
  FOR SELECT TO PUBLIC
  USING (
    user_id = public.current_app_user_id()
    OR status = 'PUBLISHED'
    OR (status IN ('SUBMITTED', 'UNDER_REVIEW') AND public.is_staff())
    OR public.is_admin()
  );

CREATE POLICY achievements_insert_own ON public.achievements
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user() AND user_id = public.current_app_user_id()
  );

CREATE POLICY achievements_update_own_draft_or_rejected ON public.achievements
  FOR UPDATE TO authenticated
  USING (
    public.is_active_user()
    AND user_id = public.current_app_user_id()
    AND status IN ('DRAFT', 'REJECTED')
  )
  WITH CHECK (
    public.is_active_user()
    AND user_id = public.current_app_user_id()
    AND status IN ('DRAFT', 'REJECTED')
  );

CREATE POLICY achievements_delete_own_draft_or_rejected ON public.achievements
  FOR DELETE TO authenticated
  USING (
    public.is_active_user()
    AND user_id = public.current_app_user_id()
    AND status IN ('DRAFT', 'REJECTED')
  );

CREATE POLICY stories_select ON public.stories
  FOR SELECT TO PUBLIC
  USING (
    author_id = public.current_app_user_id()
    OR status = 'PUBLISHED'
    OR (status IN ('SUBMITTED', 'UNDER_REVIEW') AND public.is_staff())
    OR public.is_admin()
  );

CREATE POLICY stories_insert_own ON public.stories
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user() AND author_id = public.current_app_user_id()
  );

CREATE POLICY stories_update_own_draft_or_rejected ON public.stories
  FOR UPDATE TO authenticated
  USING (
    public.is_active_user()
    AND author_id = public.current_app_user_id()
    AND status IN ('DRAFT', 'REJECTED')
  )
  WITH CHECK (
    public.is_active_user()
    AND author_id = public.current_app_user_id()
    AND status IN ('DRAFT', 'REJECTED')
  );

CREATE POLICY stories_delete_own_draft_or_rejected ON public.stories
  FOR DELETE TO authenticated
  USING (
    public.is_active_user()
    AND author_id = public.current_app_user_id()
    AND status IN ('DRAFT', 'REJECTED')
  );

-- opportunities: NEVER public (no anon grant, authenticated-only policy).
-- Published listings readable by active students/alumni/moderators/admins —
-- faculty deliberately excluded (not granted automatically). Creation is
-- alumni/moderator/admin only, always as oneself; students cannot create.
CREATE POLICY opportunities_select ON public.opportunities
  FOR SELECT TO authenticated
  USING (
    posted_by = public.current_app_user_id()
    OR (status = 'PUBLISHED'
        AND (public.is_student_or_alumni() OR public.is_staff()))
    OR (status IN ('SUBMITTED', 'UNDER_REVIEW') AND public.is_staff())
    OR public.is_admin()
  );

CREATE POLICY opportunities_insert_eligible_poster ON public.opportunities
  FOR INSERT TO authenticated
  WITH CHECK (
    posted_by = public.current_app_user_id()
    AND (
      public.is_alumni() OR public.is_moderator() OR public.is_admin()
    )
  );

CREATE POLICY opportunities_update_own_draft_or_rejected ON public.opportunities
  FOR UPDATE TO authenticated
  USING (
    public.is_active_user()
    AND posted_by = public.current_app_user_id()
    AND status IN ('DRAFT', 'REJECTED')
  )
  WITH CHECK (
    public.is_active_user()
    AND posted_by = public.current_app_user_id()
    AND status IN ('DRAFT', 'REJECTED')
  );

CREATE POLICY opportunities_delete_own_draft_or_rejected ON public.opportunities
  FOR DELETE TO authenticated
  USING (
    public.is_active_user()
    AND posted_by = public.current_app_user_id()
    AND status IN ('DRAFT', 'REJECTED')
  );

-- mentorship: NEVER public. Discovery (available profiles) restricted to
-- active students/alumni/moderators/admins; faculty excluded. Only verified
-- alumni (role + alumni_profiles row) may hold a mentorship profile, so a
-- student cannot create one.
CREATE POLICY mentorship_profiles_select ON public.mentorship_profiles
  FOR SELECT TO authenticated
  USING (
    user_id = public.current_app_user_id()
    OR (
      is_available = true
      AND (public.is_student_or_alumni() OR public.is_staff())
    )
    OR public.is_admin()
  );

CREATE POLICY mentorship_profiles_insert_verified_alumni ON public.mentorship_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = public.current_app_user_id()
    AND public.is_alumni()
    AND EXISTS (
      SELECT 1 FROM public.alumni_profiles ap
      WHERE ap.user_id = public.current_app_user_id()
    )
  );

CREATE POLICY mentorship_profiles_update_own ON public.mentorship_profiles
  FOR UPDATE TO authenticated
  USING (
    public.is_active_user() AND user_id = public.current_app_user_id()
  )
  WITH CHECK (
    public.is_active_user() AND user_id = public.current_app_user_id()
  );

CREATE POLICY mentorship_profiles_delete_own ON public.mentorship_profiles
  FOR DELETE TO authenticated
  USING (
    public.is_active_user() AND user_id = public.current_app_user_id()
  );

-- department_history: PUBLISHED readable by everyone; drafts visible to staff
-- for curation. All writes are server-side (curated, audited content).
CREATE POLICY department_history_select ON public.department_history
  FOR SELECT TO PUBLIC
  USING (status = 'PUBLISHED' OR public.is_staff());

-- notifications: owners read their own and flip read state (columns already
-- limited to is_read/read_at by GRANT). Creation is server-side only — no
-- INSERT grant exists, so users cannot notify each other or forge ownership.
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id());

CREATE POLICY notifications_update_own_read_state ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    public.is_active_user() AND user_id = public.current_app_user_id()
  )
  WITH CHECK (
    public.is_active_user() AND user_id = public.current_app_user_id()
  );

-- audit_logs: active admins read; nobody writes via the API (the append-only
-- trigger independently rejects every UPDATE/DELETE; INSERT has no grant).
-- Moderators get no audit access in Phase 4 (not genuinely required yet).
CREATE POLICY audit_logs_select_admin ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());
