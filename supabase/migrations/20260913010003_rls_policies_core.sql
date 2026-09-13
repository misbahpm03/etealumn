-- Phase 4: RLS policies for identity, profile, batch, and people tables.
--
-- users: NO direct writes for anyone (not even admins). Role/status changes
-- must be auditable, so they go through server-side operations; direct SQL
-- cannot escalate roles, flip statuses, or reassign auth_user_id. Reads are
-- own-row plus active admins (emails must never leak to other members).
--
-- Every direct write below additionally requires an ACTIVE account: PENDING,
-- SUSPENDED, and DEACTIVATED users hold no member privileges (reading one's
-- own rows stays allowed — the app blocks usage server-side instead).

CREATE POLICY users_select_own_or_admin ON public.users
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_admin());

-- profiles (raw table holds phone/socials: NEVER publicly readable; cross-user
-- reads go through the safe projection views in 10006).
CREATE POLICY profiles_select_owner_or_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id() OR public.is_admin());

CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user() AND user_id = public.current_app_user_id()
  );

CREATE POLICY profiles_update_own_or_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.is_active_user()
    AND (user_id = public.current_app_user_id() OR public.is_admin())
  )
  WITH CHECK (
    public.is_active_user()
    AND (user_id = public.current_app_user_id() OR public.is_admin())
  );

-- profile_privacy: owner + admin only. No public/member access, no delete
-- (settings live and die with the user record).
CREATE POLICY profile_privacy_select_owner_or_admin ON public.profile_privacy
  FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id() OR public.is_admin());

CREATE POLICY profile_privacy_insert_own ON public.profile_privacy
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user() AND user_id = public.current_app_user_id()
  );

CREATE POLICY profile_privacy_update_own_or_admin ON public.profile_privacy
  FOR UPDATE TO authenticated
  USING (
    public.is_active_user()
    AND (user_id = public.current_app_user_id() OR public.is_admin())
  )
  WITH CHECK (
    public.is_active_user()
    AND (user_id = public.current_app_user_id() OR public.is_admin())
  );

-- batches: non-sensitive metadata, publicly readable (including ARCHIVED —
-- history stays browsable). All writes are server-side so batch changes are
-- audited; no direct INSERT/UPDATE/DELETE for any API role.
CREATE POLICY batches_select_public ON public.batches
  FOR SELECT TO PUBLIC USING (true);

-- student/alumni profiles: owner + admin reads; narrow self-service updates
-- (columns already restricted by GRANTs — no INSERT/DELETE grants exist, so
-- creation, batch assignment, and student ids are server-side only, which
-- also makes "create a profile for another user" impossible).
CREATE POLICY student_profiles_select_owner_or_admin ON public.student_profiles
  FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id() OR public.is_admin());

CREATE POLICY student_profiles_update_owner_or_admin ON public.student_profiles
  FOR UPDATE TO authenticated
  USING (
    public.is_active_user()
    AND (user_id = public.current_app_user_id() OR public.is_admin())
  )
  WITH CHECK (
    public.is_active_user()
    AND (user_id = public.current_app_user_id() OR public.is_admin())
  );

CREATE POLICY alumni_profiles_select_owner_or_admin ON public.alumni_profiles
  FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id() OR public.is_admin());

CREATE POLICY alumni_profiles_update_owner_or_admin ON public.alumni_profiles
  FOR UPDATE TO authenticated
  USING (
    public.is_active_user()
    AND (user_id = public.current_app_user_id() OR public.is_admin())
  )
  WITH CHECK (
    public.is_active_user()
    AND (user_id = public.current_app_user_id() OR public.is_admin())
  );

-- work_experience / education: owner-managed content (user_id pinned by
-- policy on every command, so impersonation is impossible); admins may
-- manage directly as these carry no lifecycle or privilege semantics.
CREATE POLICY work_experience_select_owner_or_admin ON public.work_experience
  FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id() OR public.is_admin());

CREATE POLICY work_experience_insert_owner_or_admin ON public.work_experience
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user()
    AND (user_id = public.current_app_user_id() OR public.is_admin())
  );

CREATE POLICY work_experience_update_owner_or_admin ON public.work_experience
  FOR UPDATE TO authenticated
  USING (
    public.is_active_user()
    AND (user_id = public.current_app_user_id() OR public.is_admin())
  )
  WITH CHECK (
    public.is_active_user()
    AND (user_id = public.current_app_user_id() OR public.is_admin())
  );

CREATE POLICY work_experience_delete_owner_or_admin ON public.work_experience
  FOR DELETE TO authenticated
  USING (
    public.is_active_user()
    AND (user_id = public.current_app_user_id() OR public.is_admin())
  );

CREATE POLICY education_select_owner_or_admin ON public.education
  FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id() OR public.is_admin());

CREATE POLICY education_insert_owner_or_admin ON public.education
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user()
    AND (user_id = public.current_app_user_id() OR public.is_admin())
  );

CREATE POLICY education_update_owner_or_admin ON public.education
  FOR UPDATE TO authenticated
  USING (
    public.is_active_user()
    AND (user_id = public.current_app_user_id() OR public.is_admin())
  )
  WITH CHECK (
    public.is_active_user()
    AND (user_id = public.current_app_user_id() OR public.is_admin())
  );

CREATE POLICY education_delete_owner_or_admin ON public.education
  FOR DELETE TO authenticated
  USING (
    public.is_active_user()
    AND (user_id = public.current_app_user_id() OR public.is_admin())
  );
