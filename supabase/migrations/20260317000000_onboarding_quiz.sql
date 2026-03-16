-- Quiz d'onboarding : catégories et formations

-- Catégories : quiz optionnel (spreadsheet id + nom de feuille)
alter table public.categories
  add column if not exists onboarding_quiz_sheet_id text,
  add column if not exists onboarding_quiz_sheet_name text;

comment on column public.categories.onboarding_quiz_sheet_id is 'ID du Google Sheet du quiz d''onboarding de la catégorie';
comment on column public.categories.onboarding_quiz_sheet_name is 'Nom de la feuille (onglet) du quiz d''onboarding dans ce Sheet';

-- Formations : nom de la feuille du quiz d'onboarding (dans quiz_spreadsheet_id existant)
alter table public.courses
  add column if not exists onboarding_quiz_sheet_name text;

comment on column public.courses.onboarding_quiz_sheet_name is 'Nom de la feuille (onglet) du quiz d''onboarding dans quiz_spreadsheet_id';
