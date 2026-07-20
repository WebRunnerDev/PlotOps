-- Add task_type and human-readable task_key (e.g. TASK-1, BUG-5) to tasks.
-- The key is generated via a per-project sequence stored in project_task_sequences.

-- 1. task_type enum -------------------------------------------------------
create type public.task_type as enum ('task', 'bug', 'feature');

alter table public.tasks
  add column if not exists task_type public.task_type not null default 'task';

-- 2. task_key column -------------------------------------------------------
alter table public.tasks
  add column if not exists task_key text;

create unique index if not exists tasks_project_task_key_unique
  on public.tasks (project_id, task_key);

-- 3. per-project sequence table -------------------------------------------
create table if not exists public.project_task_sequences (
  project_id uuid primary key references public.projects (id) on delete cascade,
  next_val   bigint not null default 1
);

alter table public.project_task_sequences enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'project_task_sequences'
      and policyname = 'pts_owner'
  ) then
    create policy "pts_owner"
      on public.project_task_sequences
      for all
      to authenticated
      using  (public.is_project_owner(project_id))
      with check (public.is_project_owner(project_id));
  end if;
end;
$$;

grant select, insert, update on public.project_task_sequences to authenticated;

-- 4. trigger function that sets task_key before insert --------------------
create or replace function public.set_task_key()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  seq bigint;
  prefix text;
begin
  -- advance the per-project counter atomically
  insert into public.project_task_sequences (project_id, next_val)
  values (NEW.project_id, 2)
  on conflict (project_id)
  do update set next_val = public.project_task_sequences.next_val + 1
  returning public.project_task_sequences.next_val - 1 into seq;

  prefix := case NEW.task_type
    when 'bug'     then 'BUG'
    when 'feature' then 'FEAT'
    else                'TASK'
  end;

  NEW.task_key := prefix || '-' || seq;
  return NEW;
end;
$$;

drop trigger if exists trg_set_task_key on public.tasks;
create trigger trg_set_task_key
  before insert on public.tasks
  for each row execute function public.set_task_key();

-- 5. back-fill existing rows so task_key is never null --------------------
do $$
declare
  r   record;
  seq bigint;
  pfx text;
begin
  for r in
    select id, project_id, task_type, created_at
    from public.tasks
    where task_key is null
    order by project_id, created_at
  loop
    pfx := case r.task_type
      when 'bug'     then 'BUG'
      when 'feature' then 'FEAT'
      else                'TASK'
    end;

    insert into public.project_task_sequences (project_id, next_val)
    values (r.project_id, 2)
    on conflict (project_id)
    do update set next_val = public.project_task_sequences.next_val + 1
    returning public.project_task_sequences.next_val - 1 into seq;

    update public.tasks
    set task_key = pfx || '-' || seq
    where id = r.id;
  end loop;
end;
$$;

-- now make task_key not null after back-fill
alter table public.tasks
  alter column task_key set not null;

notify pgrst, 'reload schema';
