-- Statut unifié à 3 états : pending (en attente), draft (brouillon), published (publié)
-- Formations (courses) et catégories (categories)

-- Courses : statut
alter table public.courses
  add column if not exists status text default 'draft'
    check (status in ('pending', 'draft', 'published'));

update public.courses
set status = case when published = true then 'published' else 'draft' end
where status is null or status = 'draft';

comment on column public.courses.status is 'pending = en attente, draft = brouillon, published = publié (visible au catalogue)';

-- Categories : statut (remplace approved pour cohérence)
alter table public.categories
  add column if not exists status text default 'pending'
    check (status in ('pending', 'draft', 'published'));

update public.categories
set status = case when approved = true then 'published' else coalesce(status, 'pending') end
where status is null;

comment on column public.categories.status is 'pending = en attente, draft = brouillon, published = publié';
