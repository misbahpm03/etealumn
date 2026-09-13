-- Phase 3: users, profiles, profile privacy.
--
-- `auth_user_id` references the authentication provider's user id. There is
-- deliberately NO foreign key to `auth.users`: that would couple the schema to
-- Supabase's internal schema and break database portability. The link is
-- managed by the application layer (one app user per auth user, enforced by
-- the UNIQUE constraint).

CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  role public.user_role NOT NULL,
  status public.user_status NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz NULL,
  CONSTRAINT users_email_nonempty CHECK (char_length(btrim(email)) > 0),
  -- Application normalizes email to lowercase before write; the database
  -- rejects anything else so `UNIQUE (email)` cannot be bypassed by case.
  CONSTRAINT users_email_lowercase CHECK (email = lower(email))
);

CREATE INDEX users_role_idx ON public.users (role);
CREATE INDEX users_status_idx ON public.users (status);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users (id) ON DELETE CASCADE,
  full_name text NOT NULL,
  display_name text NULL,
  -- Logical storage reference (bucket/path), never a public URL.
  profile_photo_path text NULL,
  bio text NULL,
  phone text NULL,
  location text NULL,
  website_url text NULL,
  linkedin_url text NULL,
  facebook_url text NULL,
  github_url text NULL,
  profile_visibility public.document_visibility NOT NULL DEFAULT 'PRIVATE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_full_name_nonempty CHECK (char_length(btrim(full_name)) > 0),
  CONSTRAINT profiles_website_url_protocol CHECK (website_url IS NULL OR website_url ~ '^https?://'),
  CONSTRAINT profiles_linkedin_url_protocol CHECK (linkedin_url IS NULL OR linkedin_url ~ '^https?://'),
  CONSTRAINT profiles_facebook_url_protocol CHECK (facebook_url IS NULL OR facebook_url ~ '^https?://'),
  CONSTRAINT profiles_github_url_protocol CHECK (github_url IS NULL OR github_url ~ '^https?://')
);

CREATE TABLE public.profile_privacy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users (id) ON DELETE CASCADE,
  show_email boolean NOT NULL DEFAULT false,
  show_phone boolean NOT NULL DEFAULT false,
  show_location boolean NOT NULL DEFAULT true,
  show_bio boolean NOT NULL DEFAULT true,
  show_career boolean NOT NULL DEFAULT true,
  show_education boolean NOT NULL DEFAULT true,
  show_social_links boolean NOT NULL DEFAULT true,
  show_profile_publicly boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
