-- Done column flag for Close Sprint completion suggestions (wave 3.1).
-- At most one Done column per board (MVP); backfill rightmost column.

alter table public.board_columns
  add column if not exists is_done boolean not null default false;

comment on column public.board_columns.is_done is
  'When true, Close Sprint pre-checks Tasks in this column as completed. At most one per board.';

-- Backfill: rightmost column (max position) per board is Done.
update public.board_columns as bc
set is_done = true
from (
  select distinct on (board_id) id, board_id
  from public.board_columns
  order by board_id, position desc, id desc
) as rightmost
where bc.board_id = rightmost.board_id
  and bc.id = rightmost.id;

create unique index if not exists board_columns_one_done_per_board_idx
  on public.board_columns (board_id)
  where is_done;

-- New boards: seed Done as is_done = true.
create or replace function public.create_board_with_columns(
  p_project_id uuid,
  p_name text,
  p_base_branch text
)
returns public.boards
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_position integer;
  board_row public.boards;
  board_name text;
  branch_name text;
begin
  if not public.can_manage_board(p_project_id) then
    raise exception 'Only managers can create boards'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.projects as p where p.id = p_project_id
  ) then
    raise exception 'Project not found'
      using errcode = 'P0002';
  end if;

  board_name := nullif(btrim(coalesce(p_name, '')), '');
  if board_name is null then
    board_name := 'Board';
  end if;

  branch_name := nullif(btrim(coalesce(p_base_branch, '')), '');
  if branch_name is null then
    branch_name := 'main';
  end if;

  select coalesce(max(b.position), -1) + 1 into next_position
  from public.boards as b
  where b.project_id = p_project_id;

  insert into public.boards (project_id, name, position, base_branch)
  values (p_project_id, board_name, next_position, branch_name)
  returning * into board_row;

  insert into public.board_columns (id, board_id, project_id, name, position, is_done)
  values
    ('todo', board_row.id, p_project_id, 'To Do', 0, false),
    ('in_progress', board_row.id, p_project_id, 'In Progress', 1, false),
    ('in_review', board_row.id, p_project_id, 'In Review', 2, false),
    ('done', board_row.id, p_project_id, 'Done', 3, true);

  return board_row;
end;
$$;

revoke all on function public.create_board_with_columns(uuid, text, text) from public;
grant execute on function public.create_board_with_columns(uuid, text, text) to authenticated;

-- Project insert trigger: same Done seed.
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

  insert into public.board_columns (id, board_id, project_id, name, position, is_done)
  values
    ('todo', new_board_id, new.id, 'To Do', 0, false),
    ('in_progress', new_board_id, new.id, 'In Progress', 1, false),
    ('in_review', new_board_id, new.id, 'In Review', 2, false),
    ('done', new_board_id, new.id, 'Done', 3, true);

  return new;
end;
$$;

-- Atomic set/clear of the single Done column for a board.
create or replace function public.set_board_done_column(
  p_board_id uuid,
  p_column_id text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  project_uuid uuid;
begin
  select b.project_id into project_uuid
  from public.boards as b
  where b.id = p_board_id;

  if project_uuid is null then
    raise exception 'Board not found'
      using errcode = 'P0002';
  end if;

  if not public.can_manage_board(project_uuid) then
    raise exception 'Only managers can set the Done column'
      using errcode = '42501';
  end if;

  if p_column_id is not null and not exists (
    select 1
    from public.board_columns as bc
    where bc.board_id = p_board_id
      and bc.id = p_column_id
  ) then
    raise exception 'Column not found'
      using errcode = 'P0002';
  end if;

  update public.board_columns as bc
  set is_done = false
  where bc.board_id = p_board_id
    and bc.is_done;

  if p_column_id is not null then
    update public.board_columns as bc
    set is_done = true
    where bc.board_id = p_board_id
      and bc.id = p_column_id;
  end if;
end;
$$;

revoke all on function public.set_board_done_column(uuid, text) from public;
grant execute on function public.set_board_done_column(uuid, text) to authenticated;
