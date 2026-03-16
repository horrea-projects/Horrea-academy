-- Un fichier Google Sheet par formation (feuilles = quiz par module + final)
-- Onboarding formation : présentation embed
-- Catégories : onboarding optionnel

-- Courses : fichier quiz unique + nom feuille quiz final + présentation onboarding
alter table public.courses
  add column if not exists quiz_spreadsheet_id text,
  add column if not exists final_quiz_sheet_name text,
  add column if not exists onboarding_presentation_embed_url text;

comment on column public.courses.quiz_spreadsheet_id is 'ID du fichier Google Sheet contenant toutes les feuilles de quiz (une feuille par module + une pour le final)';
comment on column public.courses.final_quiz_sheet_name is 'Nom de la feuille (onglet) du quiz de fin de formation dans quiz_spreadsheet_id';
comment on column public.courses.onboarding_presentation_embed_url is 'URL embed de la présentation d''onboarding';

-- Modules : nom de la feuille pour le quiz (dans le fichier de la formation)
alter table public.course_modules
  add column if not exists quiz_sheet_name text;

comment on column public.course_modules.quiz_sheet_name is 'Nom de la feuille (onglet) du quiz de ce module dans le quiz_spreadsheet_id de la formation';

-- Catégories : onboarding optionnel
alter table public.categories
  add column if not exists onboarding_title text,
  add column if not exists onboarding_content text,
  add column if not exists onboarding_presentation_embed_url text;

comment on column public.categories.onboarding_title is 'Titre de l''onboarding de la catégorie (optionnel)';
comment on column public.categories.onboarding_content is 'Contenu texte/HTML de l''onboarding catégorie';
comment on column public.categories.onboarding_presentation_embed_url is 'URL embed de la présentation d''onboarding catégorie';
