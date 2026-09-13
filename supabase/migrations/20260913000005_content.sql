-- Phase 3: achievements, stories, opportunities, mentorship, department memory.
--
-- Opportunities and mentorship are MEMBER-ONLY features, but access is
-- enforced by RLS in Phase 4 — the schema carries no "public" flags for them.

CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NULL,
  category text NULL,
  organization text NULL,
  achievement_date date NULL,
  evidence_url text NULL,
  -- Logical storage reference (bucket/path), never a public URL.
  image_path text NULL,
  status public.content_status NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NULL,
  CONSTRAINT achievements_title_nonempty CHECK (char_length(btrim(title)) > 0),
  CONSTRAINT achievements_evidence_url_protocol CHECK (evidence_url IS NULL OR evidence_url ~ '^https?://')
);

CREATE INDEX achievements_user_id_idx ON public.achievements (user_id);
CREATE INDEX achievements_status_idx ON public.achievements (status);
CREATE INDEX achievements_achievement_date_idx ON public.achievements (achievement_date);
CREATE INDEX achievements_category_idx ON public.achievements (category);

CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text NULL,
  content text NOT NULL,
  -- Logical storage reference (bucket/path), never a public URL.
  cover_image_path text NULL,
  status public.content_status NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NULL,
  CONSTRAINT stories_title_nonempty CHECK (char_length(btrim(title)) > 0),
  CONSTRAINT stories_slug_nonempty CHECK (char_length(btrim(slug)) > 0),
  CONSTRAINT stories_content_nonempty CHECK (char_length(btrim(content)) > 0)
);

CREATE INDEX stories_author_id_idx ON public.stories (author_id);
CREATE INDEX stories_status_idx ON public.stories (status);
CREATE INDEX stories_published_at_idx ON public.stories (published_at);

CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_by uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  organization text NULL,
  description text NOT NULL,
  category text NULL,
  location text NULL,
  application_url text NULL,
  deadline date NULL,
  status public.content_status NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NULL,
  CONSTRAINT opportunities_title_nonempty CHECK (char_length(btrim(title)) > 0),
  CONSTRAINT opportunities_description_nonempty CHECK (char_length(btrim(description)) > 0),
  CONSTRAINT opportunities_application_url_protocol CHECK (application_url IS NULL OR application_url ~ '^https?://')
);

CREATE INDEX opportunities_posted_by_idx ON public.opportunities (posted_by);
CREATE INDEX opportunities_status_idx ON public.opportunities (status);
CREATE INDEX opportunities_deadline_idx ON public.opportunities (deadline);
CREATE INDEX opportunities_category_idx ON public.opportunities (category);

CREATE TABLE public.mentorship_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users (id) ON DELETE CASCADE,
  is_available boolean NOT NULL DEFAULT false,
  areas text[] NULL,
  experience text NULL,
  preferred_topics text[] NULL,
  contact_preference text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mentorship_profiles_areas_gin ON public.mentorship_profiles USING gin (areas);
CREATE INDEX mentorship_profiles_preferred_topics_gin ON public.mentorship_profiles USING gin (preferred_topics);

CREATE TABLE public.department_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NULL,
  event_date date NULL,
  year integer NULL,
  category text NULL,
  -- Logical storage reference (bucket/path), never a public URL.
  cover_image_path text NULL,
  created_by uuid NULL REFERENCES public.users (id) ON DELETE SET NULL,
  status public.content_status NOT NULL DEFAULT 'DRAFT',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT department_history_title_nonempty CHECK (char_length(btrim(title)) > 0),
  CONSTRAINT department_history_year_range CHECK (year IS NULL OR (year >= 1900 AND year <= 2100)),
  CONSTRAINT department_history_display_order_nonnegative CHECK (display_order >= 0)
);

CREATE INDEX department_history_year_idx ON public.department_history (year);
CREATE INDEX department_history_event_date_idx ON public.department_history (event_date);
CREATE INDEX department_history_category_idx ON public.department_history (category);
CREATE INDEX department_history_status_idx ON public.department_history (status);
CREATE INDEX department_history_display_order_idx ON public.department_history (display_order);
