-- Phase 3: reliable `updated_at` handling.
--
-- One reusable trigger function keeps `updated_at` accurate without relying
-- on every application write path to set it. Applied to every mutable table
-- (i.e. every table with an `updated_at` column). Deliberately NOT applied to:
--   - document_permissions (grants are revoked/re-issued, not edited)
--   - document_versions (immutable version history)
--   - notifications (read state is tracked via `read_at`, not `updated_at`)
--   - audit_logs (append-only; updates are rejected outright)

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER profile_privacy_set_updated_at
  BEFORE UPDATE ON public.profile_privacy
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER batches_set_updated_at
  BEFORE UPDATE ON public.batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER student_profiles_set_updated_at
  BEFORE UPDATE ON public.student_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER alumni_profiles_set_updated_at
  BEFORE UPDATE ON public.alumni_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER work_experience_set_updated_at
  BEFORE UPDATE ON public.work_experience
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER education_set_updated_at
  BEFORE UPDATE ON public.education
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER document_categories_set_updated_at
  BEFORE UPDATE ON public.document_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER documents_set_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER achievements_set_updated_at
  BEFORE UPDATE ON public.achievements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER stories_set_updated_at
  BEFORE UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER opportunities_set_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER mentorship_profiles_set_updated_at
  BEFORE UPDATE ON public.mentorship_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER department_history_set_updated_at
  BEFORE UPDATE ON public.department_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
