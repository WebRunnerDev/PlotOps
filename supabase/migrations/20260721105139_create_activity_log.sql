-- Task activity feed (context log — not a full audit trail).

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_log_action_length check (char_length(action) between 1 and 64)
);

create index if not exists activity_log_task_id_created_at_idx
  on public.activity_log (task_id, created_at desc);

create index if not exists activity_log_project_id_idx
  on public.activity_log (project_id);

create or replace function public.set_activity_log_project_id()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.project_id is null then
    select t.project_id
    into new.project_id
    from public.tasks as t
    where t.id = new.task_id;
  end if;

  return new;
end;
$$;

drop trigger if exists activity_log_set_project_id on public.activity_log;

create trigger activity_log_set_project_id
  before insert on public.activity_log
  for each row
  execute function public.set_activity_log_project_id();

alter table public.activity_log enable row level security;

create policy "activity_log_select_member"
  on public.activity_log
  for select
  to authenticated
  using (public.can_view_project(project_id));

create policy "activity_log_insert_editors"
  on public.activity_log
  for insert
  to authenticated
  with check (
    public.can_edit_tasks(project_id)
    and user_id = (select auth.uid())
  );

notify pgrst, 'reload schema';
