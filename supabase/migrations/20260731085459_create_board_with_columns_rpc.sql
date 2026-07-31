-- Atomic board create: board row + default columns in one transaction.
-- Avoids orphan boards when the column seed insert fails after board insert.

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

  insert into public.board_columns (id, board_id, project_id, name, position)
  values
    ('todo', board_row.id, p_project_id, 'To Do', 0),
    ('in_progress', board_row.id, p_project_id, 'In Progress', 1),
    ('in_review', board_row.id, p_project_id, 'In Review', 2),
    ('done', board_row.id, p_project_id, 'Done', 3);

  return board_row;
end;
$$;

revoke all on function public.create_board_with_columns(uuid, text, text) from public;
grant execute on function public.create_board_with_columns(uuid, text, text) to authenticated;
