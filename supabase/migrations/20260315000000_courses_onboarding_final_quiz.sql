-- Onboarding et quiz de fin de formation sur la table courses

alter table public.courses
  add column if not exists onboarding_title text,
  add column if not exists onboarding_content text,
  add column if not exists final_quiz_sheet_id text;

comment on column public.courses.onboarding_title is 'Titre de la section Onboarding (début de formation)';
comment on column public.courses.onboarding_content is 'Contenu texte/HTML de l''onboarding';
comment on column public.courses.final_quiz_sheet_id is 'ID Google Sheet du quiz de fin de formation (après les missions)';
