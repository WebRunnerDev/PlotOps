create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  slug text not null,
  github_repo_id bigint,
  github_full_name text,
  github_html_url text,
  github_default_branch text default 'main',
  description text,
  is_private boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

alter table public.projects
  add column if not exists github_repo_id bigint;

alter table public.projects
  add column if not exists github_full_name text;

alter table public.projects
  add column if not exists github_html_url text;

alter table public.projects
  add column if not exists github_default_branch text default 'main';

alter table public.projects
  add column if not exists description text;

alter table public.projects
  add column if not exists is_private boolean default false;

alter table public.projects
  add column if not exists created_at timestamptz default now();

alter table public.projects
  add column if not exists updated_at timestamptz default now();

update public.projects
set is_private = false
where is_private is null;

update public.projects
set github_default_branch = 'main'
where github_default_branch is null;

update public.projects
set updated_at = coalesce(created_at, now())
where updated_at is null;

update public.projects
set created_at = coalesce(created_at, now())
where created_at is null;

alter table public.projects
  alter column is_private set default false;

alter table public.projects
  alter column is_private set not null;

alter table public.projects
  alter column github_default_branch set default 'main';

alter table public.projects
  alter column created_at set default now();

alter table public.projects
  alter column created_at set not null;

alter table public.projects
  alter column updated_at set default now();

alter table public.projects
  alter column updated_at set not null;

create unique index if not exists projects_owner_github_repo_unique
  on public.projects (owner_id, github_repo_id)
  where github_repo_id is not null;

create unique index if not exists projects_owner_slug_unique
  on public.projects (owner_id, slug);

create index if not exists projects_owner_id_idx on public.projects (owner_id);

alter table public.projects enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'projects'
      and policyname = 'projects_select_own'
  ) then
    create policy "projects_select_own"
      on public.projects
      for select
      to authenticated
      using ((select auth.uid()) = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'projects'
      and policyname = 'projects_insert_own'
  ) then
    create policy "projects_insert_own"
      on public.projects
      for insert
      to authenticated
      with check ((select auth.uid()) = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'projects'
      and policyname = 'projects_update_own'
  ) then
    create policy "projects_update_own"
      on public.projects
      for update
      to authenticated
      using ((select auth.uid()) = owner_id)
      with check ((select auth.uid()) = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'projects'
      and policyname = 'projects_delete_own'
  ) then
    create policy "projects_delete_own"
      on public.projects
      for delete
      to authenticated
      using ((select auth.uid()) = owner_id);
  end if;
end;
$$;

grant select, insert, update, delete on public.projects to authenticated;

create or replace function public.set_projects_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;

create trigger projects_set_updated_at
  before update on public.projects
  for each row
  execute function public.set_projects_updated_at();

notify pgrst, 'reload schema';
