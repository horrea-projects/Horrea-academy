-- Score minimum (0-100) à atteindre au quiz final pour valider la formation. Null = pas d'exigence.
alter table public.courses
  add column if not exists final_quiz_min_score integer;

comment on column public.courses.final_quiz_min_score is 'Score minimum (0-100) à atteindre au quiz final. Null = pas d''exigence.';
