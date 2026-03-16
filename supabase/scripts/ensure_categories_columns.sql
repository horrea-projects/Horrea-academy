-- =============================================================================
-- À exécuter une fois dans le SQL Editor Supabase (New query > Coller > Run).
-- Ajoute parent, auteur, statut et approbation sur la table categories pour
-- que l’admin puisse enregistrer : catégorie parente, auteur, statut (publié/brouillon/attente).
-- =============================================================================

-- 1. Parent (sous-catégories)
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories (parent_id);

-- 2. Auteur (Clerk user id)
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS created_by text;

-- 3. Approbation (legacy, gardé pour compatibilité)
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT true;
UPDATE public.categories SET approved = true WHERE approved IS NULL;

-- 4. Statut à 3 états : pending, draft, published
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
UPDATE public.categories
  SET status = CASE WHEN approved = true THEN 'published' ELSE COALESCE(status, 'pending') END
  WHERE status IS NULL;

-- Contrainte sur status (ignorer l’erreur si elle existe déjà)
DO $$
BEGIN
  ALTER TABLE public.categories
    ADD CONSTRAINT categories_status_check
    CHECK (status IN ('pending', 'draft', 'published'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Quiz d'onboarding catégorie (optionnel)
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS onboarding_quiz_sheet_id text,
  ADD COLUMN IF NOT EXISTS onboarding_quiz_sheet_name text;

-- Quiz d'onboarding formation (feuille dans quiz_spreadsheet_id)
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS onboarding_quiz_sheet_name text;
