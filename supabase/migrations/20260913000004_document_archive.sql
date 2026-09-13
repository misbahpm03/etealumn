-- Phase 3: document categories (+ seed), documents, permissions, versions.
--
-- Approval (`status`) and visibility (`visibility`) are independent columns by
-- design: a document is publicly accessible only when BOTH allow it.
-- Storage is recorded as provider/bucket/path metadata, never as URLs.

CREATE TABLE public.document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_categories_name_nonempty CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT document_categories_slug_nonempty CHECK (char_length(btrim(slug)) > 0),
  CONSTRAINT document_categories_display_order_nonnegative CHECK (display_order >= 0)
);

-- Stable reference seed. Idempotent on slug so re-application is safe.
INSERT INTO public.document_categories (name, slug, display_order) VALUES
  ('Thesis', 'thesis', 1),
  ('Thesis Book', 'thesis-book', 2),
  ('Project Report', 'project-report', 3),
  ('Research Paper', 'research-paper', 4),
  ('Publication', 'publication', 5),
  ('Conference Paper', 'conference-paper', 6),
  ('Journal Paper', 'journal-paper', 7),
  ('Technical Report', 'technical-report', 8),
  ('Lab Report', 'lab-report', 9),
  ('Other', 'other', 10)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  batch_id uuid NULL REFERENCES public.batches (id) ON DELETE SET NULL,
  category_id uuid NOT NULL REFERENCES public.document_categories (id) ON DELETE RESTRICT,
  title text NOT NULL,
  slug text NOT NULL,
  description text NULL,
  abstract text NULL,
  year integer NULL,
  supervisor_name text NULL,
  keywords text[] NULL,
  visibility public.document_visibility NOT NULL DEFAULT 'PRIVATE',
  status public.document_status NOT NULL DEFAULT 'DRAFT',
  allow_download boolean NOT NULL DEFAULT false,
  storage_provider text NOT NULL,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint NOT NULL,
  submitted_at timestamptz NULL,
  approved_at timestamptz NULL,
  approved_by uuid NULL REFERENCES public.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT documents_title_nonempty CHECK (char_length(btrim(title)) > 0),
  CONSTRAINT documents_slug_nonempty CHECK (char_length(btrim(slug)) > 0),
  CONSTRAINT documents_year_range CHECK (year IS NULL OR (year >= 1900 AND year <= 2100)),
  CONSTRAINT documents_storage_provider_nonempty CHECK (char_length(btrim(storage_provider)) > 0),
  CONSTRAINT documents_storage_bucket_nonempty CHECK (char_length(btrim(storage_bucket)) > 0),
  CONSTRAINT documents_storage_path_nonempty CHECK (char_length(btrim(storage_path)) > 0),
  CONSTRAINT documents_original_filename_nonempty CHECK (char_length(btrim(original_filename)) > 0),
  CONSTRAINT documents_mime_type_nonempty CHECK (char_length(btrim(mime_type)) > 0),
  CONSTRAINT documents_file_size_nonnegative CHECK (file_size >= 0)
);

-- Slugs are unique among live records only, so a soft-deleted record never
-- blocks slug reuse.
CREATE UNIQUE INDEX documents_slug_active_uidx ON public.documents (slug) WHERE deleted_at IS NULL;

CREATE INDEX documents_owner_id_idx ON public.documents (owner_id);
CREATE INDEX documents_batch_id_idx ON public.documents (batch_id);
CREATE INDEX documents_category_id_idx ON public.documents (category_id);
CREATE INDEX documents_year_idx ON public.documents (year);
CREATE INDEX documents_status_idx ON public.documents (status);
CREATE INDEX documents_visibility_idx ON public.documents (visibility);
CREATE INDEX documents_supervisor_name_idx ON public.documents (supervisor_name);
CREATE INDEX documents_created_at_idx ON public.documents (created_at);
CREATE INDEX documents_deleted_at_idx ON public.documents (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX documents_keywords_gin ON public.documents USING gin (keywords);

CREATE TABLE public.document_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  permission public.document_permission NOT NULL,
  granted_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NULL,
  CONSTRAINT document_permissions_unique_grant UNIQUE (document_id, user_id, permission)
);

CREATE INDEX document_permissions_document_id_idx ON public.document_permissions (document_id);
CREATE INDEX document_permissions_user_id_idx ON public.document_permissions (user_id);
CREATE INDEX document_permissions_expires_at_idx ON public.document_permissions (expires_at);

CREATE TABLE public.document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents (id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  storage_provider text NOT NULL,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint NOT NULL,
  change_note text NULL,
  uploaded_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_versions_number_positive CHECK (version_number > 0),
  CONSTRAINT document_versions_file_size_nonnegative CHECK (file_size >= 0),
  CONSTRAINT document_versions_unique_version UNIQUE (document_id, version_number),
  CONSTRAINT document_versions_storage_path_nonempty CHECK (char_length(btrim(storage_path)) > 0),
  CONSTRAINT document_versions_original_filename_nonempty CHECK (char_length(btrim(original_filename)) > 0),
  CONSTRAINT document_versions_mime_type_nonempty CHECK (char_length(btrim(mime_type)) > 0)
);

CREATE INDEX document_versions_document_id_idx ON public.document_versions (document_id);
