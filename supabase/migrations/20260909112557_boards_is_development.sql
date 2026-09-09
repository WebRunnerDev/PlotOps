-- Development Board flag: git mapping (Base branch + Allowed head patterns)
-- only applies when is_development = true.

alter table public.boards
  add column if not exists is_development boolean not null default false;

comment on column public.boards.is_development is
  'When true, Board owns Base branch + Allowed head patterns for Git PR flow.';

-- Backfill: Boards that already have a Base branch are Development Boards.
update public.boards
set is_development = true
where base_branch is not null
  and btrim(base_branch) <> '';

-- Non-dev Boards must not keep stale git mapping.
update public.boards
set
  allowed_head_patterns = '{}',
  base_branch = null
where not is_development;

alter table public.boards
  drop constraint if exists boards_development_git_mapping;

alter table public.boards
  add constraint boards_development_git_mapping
  check (
    (
      is_development
      and base_branch is not null
      and btrim(base_branch) <> ''
    )
    or (
      not is_development
      and base_branch is null
      and coalesce(cardinality(allowed_head_patterns), 0) = 0
    )
  );

drop function if exists public.create_board_with_columns(uuid, text, text);

create or replace function public.create_board_with_columns(
  p_project_id uuid,
  p_name text,
  p_base_branch text,
  p_is_development boolean default true
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
  as_development boolean;
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

  as_development := coalesce(p_is_development, false);
  if as_development then
    branch_name := nullif(btrim(coalesce(p_base_branch, '')), '');
    if branch_name is null then
      raise exception 'Development Board requires a Base branch'
        using errcode = '22023';
    end if;
  else
    branch_name := null;
  end if;

  select coalesce(max(b.position), -1) + 1 into next_position
  from public.boards as b
  where b.project_id = p_project_id;

  insert into public.boards (
    project_id,
    name,
    position,
    base_branch,
    allowed_head_patterns,
    is_development
  )
  values (
    p_project_id,
    board_name,
    next_position,
    branch_name,
    '{}',
    as_development
  )
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

revoke all on function public.create_board_with_columns(uuid, text, text, boolean) from public;
grant execute on function public.create_board_with_columns(uuid, text, text, boolean) to authenticated;

-- Default Main Board: Development when the Project has a linked GitHub repo.
create or replace function public.handle_new_project_board()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_board_id uuid;
  as_development boolean;
  branch_name text;
begin
  as_development := new.github_repo_id is not null;
  if as_development then
    branch_name := coalesce(nullif(btrim(new.github_default_branch), ''), 'main');
  else
    branch_name := null;
  end if;

  insert into public.boards (
    project_id,
    name,
    position,
    base_branch,
    allowed_head_patterns,
    is_development
  )
  values (
    new.id,
    'Main',
    0,
    branch_name,
    '{}',
    as_development
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
