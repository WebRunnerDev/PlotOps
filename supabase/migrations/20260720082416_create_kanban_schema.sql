-- Kanban schema: tasks (extend), labels, task_labels, board_columns + RLS.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  description text,
  status text not null,
  priority text,
  branch_name text,
  assignee_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.tasks
  add column if not exists deadline date;

alter table public.tasks
  add column if not exists position integer not null default 0;

alter table public.tasks
  add column if not exists pr_number integer;

alter table public.tasks
  add column if not exists pr_state text;

alter table public.tasks
  add column if not exists pr_url text;

create index if not exists tasks_project_id_idx on public.tasks (project_id);
create index if not exists tasks_project_status_position_idx
  on public.tasks (project_id, status, position);

create table if not exists public.board_columns (
  id text not null,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (project_id, id)
);

create index if not exists board_columns_project_position_idx
  on public.board_columns (project_id, position);

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  color text not null,
  custom_color text,
  created_at timestamptz not null default now()
);

create unique index if not exists labels_project_name_unique
  on public.labels (project_id, lower(name));

create index if not exists labels_project_id_idx on public.labels (project_id);

create table if not exists public.task_labels (
  task_id uuid not null references public.tasks (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  primary key (task_id, label_id)
);

create index if not exists task_labels_label_id_idx on public.task_labels (label_id);

create or replace function public.is_project_owner(project_uuid uuid)
returns boolean
language sql
security invoker
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.projects as p
    where p.id = project_uuid
      and p.owner_id = (select auth.uid())
  );
$$;

alter table public.tasks enable row level security;
alter table public.board_columns enable row level security;
alter table public.labels enable row level security;
alter table public.task_labels enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tasks'
      and policyname = 'tasks_select_own_projects'
  ) then
    create policy "tasks_select_own_projects"
      on public.tasks
      for select
      to authenticated
      using (public.is_project_owner(project_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tasks'
      and policyname = 'tasks_insert_own_projects'
  ) then
    create policy "tasks_insert_own_projects"
      on public.tasks
      for insert
      to authenticated
      with check (public.is_project_owner(project_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tasks'
      and policyname = 'tasks_update_own_projects'
  ) then
    create policy "tasks_update_own_projects"
      on public.tasks
      for update
      to authenticated
      using (public.is_project_owner(project_id))
      with check (public.is_project_owner(project_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tasks'
      and policyname = 'tasks_delete_own_projects'
  ) then
    create policy "tasks_delete_own_projects"
      on public.tasks
      for delete
      to authenticated
      using (public.is_project_owner(project_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'board_columns'
      and policyname = 'board_columns_select_own_projects'
  ) then
    create policy "board_columns_select_own_projects"
      on public.board_columns
      for select
      to authenticated
      using (public.is_project_owner(project_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'board_columns'
      and policyname = 'board_columns_insert_own_projects'
  ) then
    create policy "board_columns_insert_own_projects"
      on public.board_columns
      for insert
      to authenticated
      with check (public.is_project_owner(project_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'board_columns'
      and policyname = 'board_columns_update_own_projects'
  ) then
    create policy "board_columns_update_own_projects"
      on public.board_columns
      for update
      to authenticated
      using (public.is_project_owner(project_id))
      with check (public.is_project_owner(project_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'board_columns'
      and policyname = 'board_columns_delete_own_projects'
  ) then
    create policy "board_columns_delete_own_projects"
      on public.board_columns
      for delete
      to authenticated
      using (public.is_project_owner(project_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'labels'
      and policyname = 'labels_select_own_projects'
  ) then
    create policy "labels_select_own_projects"
      on public.labels
      for select
      to authenticated
      using (public.is_project_owner(project_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'labels'
      and policyname = 'labels_insert_own_projects'
  ) then
    create policy "labels_insert_own_projects"
      on public.labels
      for insert
      to authenticated
      with check (public.is_project_owner(project_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'labels'
      and policyname = 'labels_update_own_projects'
  ) then
    create policy "labels_update_own_projects"
      on public.labels
      for update
      to authenticated
      using (public.is_project_owner(project_id))
      with check (public.is_project_owner(project_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'labels'
      and policyname = 'labels_delete_own_projects'
  ) then
    create policy "labels_delete_own_projects"
      on public.labels
      for delete
      to authenticated
      using (public.is_project_owner(project_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'task_labels'
      and policyname = 'task_labels_select_own_projects'
  ) then
    create policy "task_labels_select_own_projects"
      on public.task_labels
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.tasks as t
          where t.id = task_labels.task_id
            and public.is_project_owner(t.project_id)
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'task_labels'
      and policyname = 'task_labels_insert_own_projects'
  ) then
    create policy "task_labels_insert_own_projects"
      on public.task_labels
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.tasks as t
          where t.id = task_labels.task_id
            and public.is_project_owner(t.project_id)
        )
        and exists (
          select 1
          from public.labels as l
          where l.id = task_labels.label_id
            and public.is_project_owner(l.project_id)
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'task_labels'
      and policyname = 'task_labels_delete_own_projects'
  ) then
    create policy "task_labels_delete_own_projects"
      on public.task_labels
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.tasks as t
          where t.id = task_labels.task_id
            and public.is_project_owner(t.project_id)
        )
      );
  end if;
end;
$$;

grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.board_columns to authenticated;
grant select, insert, update, delete on public.labels to authenticated;
grant select, insert, delete on public.task_labels to authenticated;

notify pgrst, 'reload schema';
