-- Multi-board under Project + Base branch / Allowed head patterns (ADR 0006).

-- ---------------------------------------------------------------------------
-- boards
-- ---------------------------------------------------------------------------

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  base_branch text not null default 'main',
  allowed_head_patterns text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create index if not exists boards_project_position_idx
  on public.boards (project_id, position);

-- One Main board per existing project
insert into public.boards (project_id, name, position, base_branch)
select
  p.id,
  'Main',
  0,
  coalesce(nullif(p.github_default_branch, ''), 'main')
from public.projects as p
where not exists (
  select 1 from public.boards as b where b.project_id = p.id
);

-- ---------------------------------------------------------------------------
-- board_columns → board-scoped
-- ---------------------------------------------------------------------------

alter table public.board_columns
  add column if not exists board_id uuid references public.boards (id) on delete cascade;

update public.board_columns as bc
set board_id = b.id
from public.boards as b
where b.project_id = bc.project_id
  and bc.board_id is null;

-- Drop columns that cannot be mapped (orphan projects without boards should not exist)
delete from public.board_columns where board_id is null;

alter table public.board_columns
  alter column board_id set not null;

alter table public.board_columns drop constraint if exists board_columns_pkey;
alter table public.board_columns
  add primary key (board_id, id);

create index if not exists board_columns_board_position_idx
  on public.board_columns (board_id, position);

-- ---------------------------------------------------------------------------
-- tasks → board-scoped
-- ---------------------------------------------------------------------------

alter table public.tasks
  add column if not exists board_id uuid references public.boards (id) on delete restrict;

update public.tasks as t
set board_id = b.id
from public.boards as b
where b.project_id = t.project_id
  and t.board_id is null;

alter table public.tasks
  alter column board_id set not null;

create index if not exists tasks_board_status_position_idx
  on public.tasks (board_id, status, position);

-- ---------------------------------------------------------------------------
-- New project → Main board + default columns
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_project_board()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_board_id uuid;
begin
  insert into public.boards (project_id, name, position, base_branch)
  values (
    new.id,
    'Main',
    0,
    coalesce(nullif(new.github_default_branch, ''), 'main')
  )
  returning id into new_board_id;

  insert into public.board_columns (id, board_id, project_id, name, position)
  values
    ('todo', new_board_id, new.id, 'To Do', 0),
    ('in_progress', new_board_id, new.id, 'In Progress', 1),
    ('in_review', new_board_id, new.id, 'In Review', 2),
    ('done', new_board_id, new.id, 'Done', 3);

  return new;
end;
$$;

drop trigger if exists projects_create_default_board on public.projects;
create trigger projects_create_default_board
  after insert on public.projects
  for each row
  execute function public.handle_new_project_board();

-- ---------------------------------------------------------------------------
-- Guards: cannot delete last board; cannot delete board with tasks (FK)
-- ---------------------------------------------------------------------------

create or replace function public.guard_last_board()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (
    select count(*)::integer
    from public.boards as b
    where b.project_id = old.project_id
  ) <= 1 then
    raise exception 'Cannot delete the last board in a project';
  end if;

  if exists (
    select 1 from public.tasks as t where t.board_id = old.id
  ) then
    raise exception 'Cannot delete a board that still has tasks';
  end if;

  return old;
end;
$$;

drop trigger if exists boards_guard_delete on public.boards;
create trigger boards_guard_delete
  before delete on public.boards
  for each row
  execute function public.guard_last_board();

-- Keep board_columns.project_id aligned with boards.project_id
create or replace function public.sync_board_column_project_id()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  select b.project_id into new.project_id
  from public.boards as b
  where b.id = new.board_id;

  if new.project_id is null then
    raise exception 'board_columns.board_id must reference an existing board';
  end if;

  return new;
end;
$$;

drop trigger if exists board_columns_sync_project_id on public.board_columns;
create trigger board_columns_sync_project_id
  before insert or update of board_id on public.board_columns
  for each row
  execute function public.sync_board_column_project_id();

-- Keep tasks.project_id aligned when moving between boards
create or replace function public.sync_task_board_project_id()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  board_project uuid;
begin
  select b.project_id into board_project
  from public.boards as b
  where b.id = new.board_id;

  if board_project is null then
    raise exception 'tasks.board_id must reference an existing board';
  end if;

  if new.project_id is distinct from board_project then
    new.project_id := board_project;
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_sync_board_project on public.tasks;
create trigger tasks_sync_board_project
  before insert or update of board_id on public.tasks
  for each row
  execute function public.sync_task_board_project_id();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.boards enable row level security;

drop policy if exists "boards_select_member" on public.boards;
create policy "boards_select_member"
  on public.boards
  for select
  to authenticated
  using (public.can_view_project(project_id));

drop policy if exists "boards_insert_managers" on public.boards;
create policy "boards_insert_managers"
  on public.boards
  for insert
  to authenticated
  with check (public.can_manage_board(project_id));

drop policy if exists "boards_update_managers" on public.boards;
create policy "boards_update_managers"
  on public.boards
  for update
  to authenticated
  using (public.can_manage_board(project_id))
  with check (public.can_manage_board(project_id));

drop policy if exists "boards_delete_managers" on public.boards;
create policy "boards_delete_managers"
  on public.boards
  for delete
  to authenticated
  using (public.can_manage_board(project_id));

grant select, insert, update, delete on public.boards to authenticated;

revoke all on function public.handle_new_project_board() from public;
revoke all on function public.guard_last_board() from public;
revoke all on function public.sync_board_column_project_id() from public;
revoke all on function public.sync_task_board_project_id() from public;
