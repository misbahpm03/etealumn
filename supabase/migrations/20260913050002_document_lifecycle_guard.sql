-- Phase 9: database-authoritative document lifecycle enforcement.
--
-- The service layer (`AcademicDocumentService.requireTransition`) validates
-- every transition first and returns user-safe errors, but service-role
-- writers bypass RLS — so the transition map must ALSO hold at the database
-- level. This trigger is the final arbiter: no path (service bug, ad-hoc
-- SQL, future writer) can jump the lifecycle.
--
-- Map (mirrors `LIFECYCLE_TRANSITIONS` in src/validations/documents.ts):
--   DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED -> ARCHIVED
--   UNDER_REVIEW -> REJECTED -> DRAFT (rework loop)
-- INSERT always starts at DRAFT: the insert RLS policy constrains
-- ownership/approval columns but not `status`, so without this guard a
-- direct-SQL writer could create an APPROVED row. Self-approval and role
-- gating stay service-side (the trigger sees no application roles).
CREATE OR REPLACE FUNCTION public.guard_document_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'DRAFT' THEN
      RAISE EXCEPTION 'Documents must be created as DRAFT (got %).', NEW.status
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'DRAFT' AND NEW.status = 'SUBMITTED')
      OR (OLD.status = 'SUBMITTED' AND NEW.status = 'UNDER_REVIEW')
      OR (OLD.status = 'UNDER_REVIEW' AND NEW.status = 'APPROVED')
      OR (OLD.status = 'UNDER_REVIEW' AND NEW.status = 'REJECTED')
      OR (OLD.status = 'REJECTED' AND NEW.status = 'DRAFT')
      OR (OLD.status = 'APPROVED' AND NEW.status = 'ARCHIVED')
    ) THEN
      RAISE EXCEPTION 'Invalid document lifecycle transition: % → %.', OLD.status, NEW.status
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_lifecycle_guard ON public.documents;
CREATE TRIGGER documents_lifecycle_guard
  BEFORE INSERT OR UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_document_lifecycle();
