-- Score minimum au quiz pour valider un module (0-100, optionnel)
alter table public.course_modules
  add column if not exists min_quiz_score integer;

comment on column public.course_modules.min_quiz_score is 'Score minimum (0-100) à atteindre au quiz pour pouvoir valider le module. Null = pas d''exigence.';
