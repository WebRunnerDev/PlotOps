-- Atomic column reorder: one transaction updates every position.
-- Replaces N parallel client updates that could partially commit.

create or replace function public.reorder_board_columns(
  p_board_id uuid,
  p_column_ids text[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  board_project uuid;
  expected_count integer;
  matched_count integer;
  id_count integer;
begin
  select b.project_id into board_project
  from public.boards as b
  where b.id = p_board_id;

  if board_project is null then
    raise exception 'Board not found'
      using errcode = 'P0002';
  end if;

  if not public.can_manage_board(board_project) then
    raise exception 'Only managers can reorder columns'
      using errcode = '42501';
  end if;

  select count(*)::integer into expected_count
  from public.board_columns as bc
  where bc.board_id = p_board_id;

  id_count := coalesce(cardinality(p_column_ids), 0);

  if id_count = 0 or id_count <> expected_count then
    raise exception 'Column id list must include every column on the board'
      using errcode = 'P0001';
  end if;

  select count(*)::integer into matched_count
  from unnest(p_column_ids) as col_id(id)
  inner join public.board_columns as bc
    on bc.board_id = p_board_id
    and bc.id = col_id.id;

  if matched_count <> expected_count then
    raise exception 'Column id list contains unknown columns'
      using errcode = 'P0001';
  end if;

  if (
    select count(*)::integer
    from (
      select distinct unnest(p_column_ids) as id
    ) as distinct_ids
  ) <> id_count then
    raise exception 'Column id list contains duplicates'
      using errcode = 'P0001';
  end if;

  update public.board_columns as bc
  set position = (u.ordinality - 1)::integer
  from unnest(p_column_ids) with ordinality as u(id, ordinality)
  where bc.board_id = p_board_id
    and bc.id = u.id;
end;
$$;

revoke all on function public.reorder_board_columns(uuid, text[]) from public;
grant execute on function public.reorder_board_columns(uuid, text[]) to authenticated;
