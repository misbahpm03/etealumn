-- Phase 6: application-user provisioning from Supabase Auth.
--
-- When a user appears in `auth.users` (dashboard-created, invited, or
-- provider sign-up where enabled), the application must own a matching
-- `public.users` row with SAFE defaults — the browser is never trusted to
-- create its own identity record.
--
--   public.users.auth_user_id = auth.users.id  (always; never client-chosen)
--   role   = 'STUDENT'   (least privilege; elevation is admin-only, later phase)
--   status = 'PENDING'   (authenticated ≠ active member; RLS helpers gate on ACTIVE)
--
-- A minimal profile (+ default privacy row) is created in the same
-- transaction so "provisioned user ⇒ profile exists" stays invariant; the
-- placeholder name (email local-part) is onboarding-editable in a later
-- phase. Phone-only auth users (NULL email) are skipped: this application
-- is email-based and `users.email` is NOT NULL — such sessions surface as
-- "account setup incomplete" instead of half-provisioned rows.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_email text;
  app_user_id uuid;
  placeholder_name text;
BEGIN
  app_email := lower(NEW.email);

  INSERT INTO public.users (auth_user_id, email, role, status)
  VALUES (NEW.id, app_email, 'STUDENT', 'PENDING')
  ON CONFLICT (auth_user_id) DO NOTHING
  RETURNING id INTO app_user_id;

  IF app_user_id IS NULL THEN
    -- Replay/restore: the users row already exists; finish provisioning
    -- idempotently instead of failing the auth insert.
    SELECT id INTO app_user_id
    FROM public.users
    WHERE auth_user_id = NEW.id;
  END IF;

  placeholder_name :=
    COALESCE(NULLIF(split_part(app_email, '@', 1), ''), 'New member');

  INSERT INTO public.profiles (user_id, full_name)
  VALUES (app_user_id, placeholder_name)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.profile_privacy (user_id)
  VALUES (app_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.email IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();
