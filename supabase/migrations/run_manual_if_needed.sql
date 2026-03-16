-- À exécuter dans le SQL Editor Supabase si les migrations n'ont pas été appliquées (db push).
-- Copie ce bloc dans SQL Editor > New query > Run.
--
-- Si seules les catégories ne sauvegardent pas (auteur, statut, parent) : exécuter plutôt
-- le script supabase/scripts/ensure_categories_columns.sql

-- Catégories : onboarding optionnel
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS onboarding_title text;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS onboarding_content text;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS onboarding_presentation_embed_url text;

-- Courses : quiz unifié + présentation onboarding
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS quiz_spreadsheet_id text;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS final_quiz_sheet_name text;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS onboarding_presentation_embed_url text;

-- Modules : nom de la feuille quiz
ALTER TABLE public.course_modules ADD COLUMN IF NOT EXISTS quiz_sheet_name text;

-- Modules : score minimum au quiz pour valider (migration 20260320)
ALTER TABLE public.course_modules ADD COLUMN IF NOT EXISTS min_quiz_score integer;

-- Courses : score minimum au quiz final (migration 20260321)
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS final_quiz_min_score integer;

-- Catégories : parent_id pour sous-catégories (migration 20260317)
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories (parent_id);

-- Catégories : auteur et approbation (migration 20260318)
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT true;
UPDATE public.categories SET approved = true WHERE approved IS NULL;

-- Statut à 3 états (migration 20260319) : pending, draft, published
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';
UPDATE public.courses SET status = CASE WHEN published = true THEN 'published' ELSE 'draft' END WHERE status IS NULL;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
UPDATE public.categories SET status = CASE WHEN approved = true THEN 'published' ELSE COALESCE(status, 'pending') END WHERE status IS NULL;
