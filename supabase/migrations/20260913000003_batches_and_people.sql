-- Phase 3: batches, student/alumni profiles, work experience, education.
--
-- `batch_number` is intentionally NOT unique: historical department data may
-- contain irregular numbering. Human-assigned `name` is the unique handle.

CREATE TABLE public.batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  batch_number integer NULL,
  admission_year integer NULL,
  graduation_year integer NULL,
  description text NULL,
  -- Logical storage reference (bucket/path), never a public URL.
  cover_image_path text NULL,
  status public.batch_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT batches_name_nonempty CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT batches_admission_year_range CHECK (admission_year IS NULL OR (admission_year >= 1900 AND admission_year <= 2100)),
  CONSTRAINT batches_graduation_year_range CHECK (graduation_year IS NULL OR (graduation_year >= 1900 AND graduation_year <= 2100)),
  CONSTRAINT batches_year_order CHECK (graduation_year IS NULL OR admission_year IS NULL OR graduation_year >= admission_year)
);

CREATE INDEX batches_batch_number_idx ON public.batches (batch_number);
CREATE INDEX batches_admission_year_idx ON public.batches (admission_year);
CREATE INDEX batches_graduation_year_idx ON public.batches (graduation_year);
CREATE INDEX batches_status_idx ON public.batches (status);

CREATE TABLE public.student_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users (id) ON DELETE CASCADE,
  batch_id uuid NULL REFERENCES public.batches (id) ON DELETE SET NULL,
  student_id text NOT NULL UNIQUE,
  enrollment_year integer NULL,
  expected_graduation_year integer NULL,
  current_semester integer NULL,
  department text NULL,
  academic_status text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_profiles_student_id_nonempty CHECK (char_length(btrim(student_id)) > 0),
  CONSTRAINT student_profiles_enrollment_year_range CHECK (enrollment_year IS NULL OR (enrollment_year >= 1900 AND enrollment_year <= 2100)),
  CONSTRAINT student_profiles_graduation_year_range CHECK (expected_graduation_year IS NULL OR (expected_graduation_year >= 1900 AND expected_graduation_year <= 2100)),
  CONSTRAINT student_profiles_year_order CHECK (expected_graduation_year IS NULL OR enrollment_year IS NULL OR expected_graduation_year >= enrollment_year),
  CONSTRAINT student_profiles_semester_range CHECK (current_semester IS NULL OR (current_semester >= 1 AND current_semester <= 20))
);

CREATE INDEX student_profiles_batch_id_idx ON public.student_profiles (batch_id);
CREATE INDEX student_profiles_academic_status_idx ON public.student_profiles (academic_status);

CREATE TABLE public.alumni_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users (id) ON DELETE CASCADE,
  batch_id uuid NULL REFERENCES public.batches (id) ON DELETE SET NULL,
  graduation_year integer NULL,
  current_company text NULL,
  current_designation text NULL,
  current_location text NULL,
  career_summary text NULL,
  available_for_mentoring boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alumni_profiles_graduation_year_range CHECK (graduation_year IS NULL OR (graduation_year >= 1900 AND graduation_year <= 2100))
);

CREATE INDEX alumni_profiles_batch_id_idx ON public.alumni_profiles (batch_id);
CREATE INDEX alumni_profiles_graduation_year_idx ON public.alumni_profiles (graduation_year);
CREATE INDEX alumni_profiles_current_company_idx ON public.alumni_profiles (current_company);
CREATE INDEX alumni_profiles_current_designation_idx ON public.alumni_profiles (current_designation);
CREATE INDEX alumni_profiles_current_location_idx ON public.alumni_profiles (current_location);
CREATE INDEX alumni_profiles_available_for_mentoring_idx ON public.alumni_profiles (available_for_mentoring);

CREATE TABLE public.work_experience (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  company text NOT NULL,
  designation text NULL,
  location text NULL,
  start_date date NULL,
  end_date date NULL,
  is_current boolean NOT NULL DEFAULT false,
  description text NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_experience_company_nonempty CHECK (char_length(btrim(company)) > 0),
  CONSTRAINT work_experience_date_order CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CONSTRAINT work_experience_current_has_no_end CHECK (is_current = false OR end_date IS NULL),
  CONSTRAINT work_experience_display_order_nonnegative CHECK (display_order >= 0)
);

CREATE INDEX work_experience_user_id_idx ON public.work_experience (user_id);

CREATE TABLE public.education (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  institution text NOT NULL,
  degree text NULL,
  field_of_study text NULL,
  start_year integer NULL,
  end_year integer NULL,
  description text NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT education_institution_nonempty CHECK (char_length(btrim(institution)) > 0),
  CONSTRAINT education_start_year_range CHECK (start_year IS NULL OR (start_year >= 1900 AND start_year <= 2100)),
  CONSTRAINT education_end_year_range CHECK (end_year IS NULL OR (end_year >= 1900 AND end_year <= 2100)),
  CONSTRAINT education_year_order CHECK (end_year IS NULL OR start_year IS NULL OR end_year >= start_year),
  CONSTRAINT education_display_order_nonnegative CHECK (display_order >= 0)
);

CREATE INDEX education_user_id_idx ON public.education (user_id);
