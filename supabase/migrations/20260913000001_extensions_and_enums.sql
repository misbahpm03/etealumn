-- Phase 3: extensions and enums.
--
-- Extensions: none installed. `gen_random_uuid()` is built into PostgreSQL 13+
-- (Supabase runs 15+), core full-text primitives (`tsvector`/`tsquery`) are
-- built in, and `pg_trgm` will be enabled alongside the search-index migration
-- in a later phase rather than installed unused now. The schema stays
-- search-compatible by keeping searchable content in plain TEXT columns.

-- User roles. Enforced server-side and via RLS (Phase 4), never by UI alone.
CREATE TYPE public.user_role AS ENUM (
  'STUDENT',
  'ALUMNI',
  'FACULTY',
  'MODERATOR',
  'ADMIN'
);

-- Account lifecycle status.
CREATE TYPE public.user_status AS ENUM (
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'DEACTIVATED'
);

-- Who a document is visible to. PRIVATE means "Only Me" unless explicit
-- permissions were granted. Orthogonal to approval status.
CREATE TYPE public.document_visibility AS ENUM (
  'PUBLIC',
  'STUDENT_ONLY',
  'FACULTY_ONLY',
  'PRIVATE'
);

-- Document lifecycle: DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED
-- (or -> REJECTED -> edit -> resubmit). PUBLIC visibility additionally
-- requires an approved/published status.
CREATE TYPE public.document_status AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'ARCHIVED'
);

-- Explicit per-document grants. DOWNLOAD implies VIEW at the app layer.
CREATE TYPE public.document_permission AS ENUM (
  'VIEW',
  'DOWNLOAD'
);

-- Shared lifecycle for stories, achievements, opportunities, and department
-- history. All four follow draft -> review -> approved/published -> archived,
-- so one enum is semantically correct (not forced reuse).
CREATE TYPE public.content_status AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'PUBLISHED',
  'ARCHIVED'
);

-- Batch lifecycle. Batches are never hard-deleted while referenced; they age
-- out to ARCHIVED instead.
CREATE TYPE public.batch_status AS ENUM (
  'ACTIVE',
  'ARCHIVED'
);
