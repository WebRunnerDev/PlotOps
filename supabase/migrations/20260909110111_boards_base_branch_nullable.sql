-- Optional Board base branch: null when the Board is not for development
-- (no PR-merge → Done mapping).

alter table public.boards
  alter column base_branch drop not null;

alter table public.boards
  alter column base_branch drop default;

comment on column public.boards.base_branch is
  'PR merge target for Done sync; null when the Board is not for development.';

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

  -- Empty / whitespace → null (non-dev Boards); do not default to main.
  branch_name := nullif(btrim(coalesce(p_base_branch, '')), '');

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
