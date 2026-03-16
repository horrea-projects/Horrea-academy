-- Catégories : parent_id pour sous-catégories (arborescence)

alter table public.categories
  add column if not exists parent_id uuid references public.categories(id) on delete set null;

create index if not exists idx_categories_parent_id on public.categories (parent_id);

comment on column public.categories.parent_id is 'Catégorie parente pour créer une arborescence (sous-catégories).';
