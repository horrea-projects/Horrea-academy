-- Consolidated schema for Horrea Academy (plain Postgres).
-- Derived from supabase/migrations — Supabase-specific grants / pg_net removed.
-- Idempotent: safe to re-run on an empty or partially-created database.
-- Table/column names match production so a public-schema pg_dump restores cleanly.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- app_users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clerk_id text NOT NULL,
  email text NOT NULL,
  name text,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT app_users_pkey PRIMARY KEY (id),
  CONSTRAINT app_users_clerk_id_key UNIQUE (clerk_id)
);

CREATE INDEX IF NOT EXISTS idx_app_users_clerk_id ON public.app_users USING btree (clerk_id);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON public.app_users USING btree (lower(email));

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  label text NOT NULL,
  icon text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  onboarding_title text,
  onboarding_content text,
  onboarding_presentation_embed_url text,
  onboarding_quiz_sheet_id text,
  onboarding_quiz_sheet_name text,
  parent_id uuid,
  created_by text,
  approved boolean NOT NULL DEFAULT true,
  status text DEFAULT 'pending',
  CONSTRAINT categories_pkey PRIMARY KEY (id),
  CONSTRAINT categories_slug_key UNIQUE (slug),
  CONSTRAINT categories_status_check CHECK (status IN ('pending', 'draft', 'published'))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_parent_id_fkey'
  ) THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_parent_id_fkey
      FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories (parent_id);

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  duration text NOT NULL,
  category_id uuid,
  published boolean NOT NULL DEFAULT false,
  added_at timestamp with time zone DEFAULT now(),
  created_by text,
  onboarding_title text,
  onboarding_content text,
  final_quiz_sheet_id text,
  quiz_spreadsheet_id text,
  final_quiz_sheet_name text,
  onboarding_presentation_embed_url text,
  onboarding_quiz_sheet_name text,
  status text DEFAULT 'draft',
  final_quiz_min_score integer,
  CONSTRAINT courses_pkey PRIMARY KEY (id),
  CONSTRAINT courses_slug_key UNIQUE (slug),
  CONSTRAINT courses_status_check CHECK (status IN ('pending', 'draft', 'published'))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_category_id_fkey'
  ) THEN
    ALTER TABLE public.courses
      ADD CONSTRAINT courses_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- course_modules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.course_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  module_slug text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  duration text NOT NULL,
  video_embed_url text NOT NULL,
  document_embed_url text,
  presentation_embed_url text,
  quiz_sheet_id text,
  mission_id_slug text,
  content text,
  position integer NOT NULL,
  quiz_sheet_name text,
  min_quiz_score integer,
  CONSTRAINT course_modules_pkey PRIMARY KEY (id),
  CONSTRAINT course_modules_course_id_module_slug_key UNIQUE (course_id, module_slug)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_modules_course_id_fkey'
  ) THEN
    ALTER TABLE public.course_modules
      ADD CONSTRAINT course_modules_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- course_missions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.course_missions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  mission_slug text NOT NULL,
  title text NOT NULL,
  context text NOT NULL,
  objective text NOT NULL,
  instructions jsonb NOT NULL DEFAULT '[]'::jsonb,
  deliverable text NOT NULL,
  CONSTRAINT course_missions_pkey PRIMARY KEY (id),
  CONSTRAINT course_missions_course_id_mission_slug_key UNIQUE (course_id, mission_slug)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_missions_course_id_fkey'
  ) THEN
    ALTER TABLE public.course_missions
      ADD CONSTRAINT course_missions_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- user_progress
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  course_slug text NOT NULL,
  module_id text NOT NULL,
  status text NOT NULL,
  score numeric,
  type text,
  date timestamp with time zone DEFAULT now(),
  CONSTRAINT user_progress_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_user_progress_course_module
  ON public.user_progress USING btree (course_slug, module_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_email
  ON public.user_progress USING btree (lower(email));

-- ---------------------------------------------------------------------------
-- metiers / skill tree
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.metiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.metier_formations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metier_id uuid NOT NULL REFERENCES public.metiers(id) ON DELETE CASCADE,
  course_slug text NOT NULL,
  UNIQUE (metier_id, course_slug)
);

CREATE TABLE IF NOT EXISTS public.user_metiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id text NOT NULL,
  metier_id uuid NOT NULL REFERENCES public.metiers(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  assigned_by text,
  UNIQUE (clerk_id, metier_id)
);

CREATE INDEX IF NOT EXISTS idx_metier_formations_metier_id ON public.metier_formations (metier_id);
CREATE INDEX IF NOT EXISTS idx_user_metiers_clerk_id ON public.user_metiers (clerk_id);
CREATE INDEX IF NOT EXISTS idx_user_metiers_metier_id ON public.user_metiers (metier_id);

COMMENT ON TABLE public.metiers IS 'Parcours / métiers (ex: Chef de projet) avec attendus de compétences';
COMMENT ON TABLE public.metier_formations IS 'Formations requises pour chaque métier (course_slug)';
COMMENT ON TABLE public.user_metiers IS 'Métiers assignés aux utilisateurs (clerk_id) pour afficher objectifs sur l''arbre de compétences';
