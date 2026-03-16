-- Catégories : auteur (created_by) et statut d'approbation (approved) pour les propositions

alter table public.categories
  add column if not exists created_by text,
  add column if not exists approved boolean not null default true;

comment on column public.categories.created_by is 'Clerk user ID de l''auteur de la catégorie.';
comment on column public.categories.approved is 'Catégories proposées par les utilisateurs : false jusqu''à validation admin.';
