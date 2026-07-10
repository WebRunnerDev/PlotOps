-- Drop broken triggers first so upserts/updates stop failing immediately.
drop trigger if exists profiles_set_updated_at on public.profiles;
drop trigger if exists projects_set_updated_at on public.projects;

alter table public.profiles
  add column if not exists created_at timestamptz default now();

alter table public.profiles
  add column if not exists updated_at timestamptz default now();

update public.profiles
set created_at = now()
where created_at is null;

update public.profiles
set updated_at = coalesce(created_at, now())
where updated_at is null;

alter table public.profiles
  alter column created_at set default now();

alter table public.profiles
  alter column updated_at set default now();

do $$
begin
  if exists (
    select 1
    from public.profiles
    where created_at is null
  ) then
    update public.profiles set created_at = now() where created_at is null;
  end if;

  alter table public.profiles
    alter column created_at set not null;
exception
  when others then null;
end;
$$;

do $$
begin
  if exists (
    select 1
    from public.profiles
    where updated_at is null
  ) then
    update public.profiles
    set updated_at = coalesce(created_at, now())
    where updated_at is null;
  end if;

  alter table public.profiles
    alter column updated_at set not null;
exception
  when others then null;
end;
$$;

alter table public.projects
  add column if not exists updated_at timestamptz default now();

update public.projects
set updated_at = coalesce(created_at, now())
where updated_at is null;

alter table public.projects
  alter column updated_at set default now();

do $$
begin
  alter table public.projects
    alter column updated_at set not null;
exception
  when others then null;
end;
$$;

drop function if exists public.set_profiles_updated_at();
drop function if exists public.set_projects_updated_at();

create or replace function public.set_profiles_updated_at()
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

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_profiles_updated_at();

create trigger projects_set_updated_at
  before update on public.projects
  for each row
  execute function public.set_projects_updated_at();

notify pgrst, 'reload schema';
