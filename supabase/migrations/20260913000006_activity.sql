-- Phase 3: notifications and audit logs.
--
-- `audit_logs` is append-only, enforced at the database level by the trigger
-- below (independent of the RLS protection arriving in Phase 4). Historical
-- audit rows survive user deletion via ON DELETE SET NULL.

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  -- Polymorphic reference (no FK by design); entity tables vary by type.
  entity_type text NULL,
  entity_id uuid NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz NULL,
  CONSTRAINT notifications_type_nonempty CHECK (char_length(btrim(type)) > 0),
  CONSTRAINT notifications_title_nonempty CHECK (char_length(btrim(title)) > 0),
  CONSTRAINT notifications_message_nonempty CHECK (char_length(btrim(message)) > 0),
  CONSTRAINT notifications_read_at_implies_read CHECK (read_at IS NULL OR is_read = true)
);

CREATE INDEX notifications_user_id_idx ON public.notifications (user_id);
CREATE INDEX notifications_is_read_idx ON public.notifications (is_read);
CREATE INDEX notifications_created_at_idx ON public.notifications (created_at);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NULL REFERENCES public.users (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NULL,
  metadata jsonb NULL,
  ip_address inet NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_action_nonempty CHECK (char_length(btrim(action)) > 0),
  CONSTRAINT audit_logs_entity_type_nonempty CHECK (char_length(btrim(entity_type)) > 0)
);

CREATE INDEX audit_logs_actor_id_idx ON public.audit_logs (actor_id);
CREATE INDEX audit_logs_action_idx ON public.audit_logs (action);
CREATE INDEX audit_logs_entity_type_idx ON public.audit_logs (entity_type);
CREATE INDEX audit_logs_entity_id_idx ON public.audit_logs (entity_id);
CREATE INDEX audit_logs_created_at_idx ON public.audit_logs (created_at);

-- Append-only enforcement: UPDATE and DELETE on audit rows are rejected for
-- every role, including administrators, with ONE exception — the `actor_id`
-- foreign key's ON DELETE SET NULL maintenance when a user is deleted (without
-- it, deleting any audited user would fail). That exception permits only the
-- actor_id -> NULL transition with every other column byte-identical; the only
-- escape hatch beyond that is a superuser-owned maintenance operation (e.g.
-- dropping this trigger), performed outside normal application flows.
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.actor_id IS NOT NULL
     AND NEW.actor_id IS NULL
     AND OLD.id IS NOT DISTINCT FROM NEW.id
     AND OLD.action IS NOT DISTINCT FROM NEW.action
     AND OLD.entity_type IS NOT DISTINCT FROM NEW.entity_type
     AND OLD.entity_id IS NOT DISTINCT FROM NEW.entity_id
     AND OLD.metadata IS NOT DISTINCT FROM NEW.metadata
     AND OLD.ip_address IS NOT DISTINCT FROM NEW.ip_address
     AND OLD.user_agent IS NOT DISTINCT FROM NEW.user_agent
     AND OLD.created_at IS NOT DISTINCT FROM NEW.created_at
  THEN
    -- Foreign-key maintenance (ON DELETE SET NULL on actor_id). Allowed.
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit_logs is append-only: % is not allowed', TG_OP;
END;
$$;

CREATE TRIGGER audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_mutation();
