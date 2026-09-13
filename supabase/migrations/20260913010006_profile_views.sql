-- Phase 4: safe cross-user profile projections.
--
-- RLS cannot hide individual columns of a selected row, and the raw `profiles`
-- table carries phone numbers and social URLs — so no public/member SELECT
-- exists on the base table at all. Instead, these two owner-rights
-- (definer) views project ONLY public-safe columns, with per-field privacy
-- flags applied via CASE. `security_barrier` keeps filter predicates from
-- being pushed below the projection.
--
-- Deliberately NEVER exposed here: phone, email (lives in `users`, not even
-- selected), and any field whose show_* flag is off. Career/education detail
-- stays behind the raw tables (owner/admin) until directory features define
-- their own projections; work/education rows are never exposed through these
-- views.
--
-- profiles_public: anonymous + member directory. Row visible only when the
-- account is ACTIVE, the member opted into public listing, AND profile
-- visibility is PUBLIC.
CREATE VIEW public.profiles_public WITH (security_barrier = true) AS
SELECT
  p.user_id,
  p.full_name,
  p.display_name,
  p.profile_photo_path,
  CASE WHEN pp.show_bio THEN p.bio END AS bio,
  CASE WHEN pp.show_location THEN p.location END AS location,
  CASE WHEN pp.show_social_links THEN p.website_url END AS website_url,
  CASE WHEN pp.show_social_links THEN p.linkedin_url END AS linkedin_url,
  CASE WHEN pp.show_social_links THEN p.facebook_url END AS facebook_url,
  CASE WHEN pp.show_social_links THEN p.github_url END AS github_url
FROM public.profiles p
JOIN public.profile_privacy pp ON pp.user_id = p.user_id
JOIN public.users u ON u.id = p.user_id
WHERE u.status = 'ACTIVE'
  AND pp.show_profile_publicly
  AND p.profile_visibility = 'PUBLIC';

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- profiles_member: signed-in directory. Members see ACTIVE accounts whose
-- visibility admits them (PUBLIC for all active members; STUDENT_ONLY for
-- active students/alumni; FACULTY_ONLY for active faculty/staff), plus always
-- their own row. Field-level flags apply identically to the public view.
CREATE VIEW public.profiles_member WITH (security_barrier = true) AS
SELECT
  p.user_id,
  p.full_name,
  p.display_name,
  p.profile_photo_path,
  CASE WHEN pp.show_bio THEN p.bio END AS bio,
  CASE WHEN pp.show_location THEN p.location END AS location,
  CASE WHEN pp.show_social_links THEN p.website_url END AS website_url,
  CASE WHEN pp.show_social_links THEN p.linkedin_url END AS linkedin_url,
  CASE WHEN pp.show_social_links THEN p.facebook_url END AS facebook_url,
  CASE WHEN pp.show_social_links THEN p.github_url END AS github_url
FROM public.profiles p
JOIN public.profile_privacy pp ON pp.user_id = p.user_id
JOIN public.users u ON u.id = p.user_id
WHERE u.status = 'ACTIVE'
  AND (
    p.profile_visibility = 'PUBLIC'
    OR (p.profile_visibility = 'STUDENT_ONLY' AND public.is_student_or_alumni())
    OR (
      p.profile_visibility = 'FACULTY_ONLY'
      AND (public.is_faculty() OR public.is_staff())
    )
    OR p.user_id = public.current_app_user_id()
  );

GRANT SELECT ON public.profiles_member TO authenticated;
