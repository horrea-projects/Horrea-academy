-- =============================================================================
-- À exécuter une fois dans le SQL Editor Supabase (New query > Coller > Run).
-- Crée les tables pour les parcours métiers et l'arbre de compétences :
--   - metiers : définition des parcours (ex. Chef de projet)
--   - metier_formations : formations requises par métier
--   - user_metiers : métiers assignés à un utilisateur (clerk_id)
-- =============================================================================

create table if not exists public.metiers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.metier_formations (
  id uuid primary key default gen_random_uuid(),
  metier_id uuid not null references public.metiers(id) on delete cascade,
  course_slug text not null,
  unique(metier_id, course_slug)
);

create table if not exists public.user_metiers (
  id uuid primary key default gen_random_uuid(),
  clerk_id text not null,
  metier_id uuid not null references public.metiers(id) on delete cascade,
  assigned_at timestamptz default now(),
  assigned_by text,
  unique(clerk_id, metier_id)
);

create index if not exists idx_metier_formations_metier_id on public.metier_formations(metier_id);
create index if not exists idx_user_metiers_clerk_id on public.user_metiers(clerk_id);
create index if not exists idx_user_metiers_metier_id on public.user_metiers(metier_id);

comment on table public.metiers is 'Parcours / métiers (ex: Chef de projet) avec attendus de compétences';
comment on table public.metier_formations is 'Formations requises pour chaque métier (course_slug)';
comment on table public.user_metiers is 'Métiers assignés aux utilisateurs (clerk_id) pour afficher objectifs sur l''arbre de compétences';

grant select, insert, update, delete on public.metiers to service_role;
grant select, insert, update, delete on public.metier_formations to service_role;
grant select, insert, update, delete on public.user_metiers to service_role;
grant select on public.metiers to authenticated;
grant select on public.metier_formations to authenticated;
grant select, insert, delete on public.user_metiers to authenticated;
