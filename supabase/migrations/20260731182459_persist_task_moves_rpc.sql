-- Atomic board task moves: one transaction updates every position/status.
-- Replaces N parallel client updates that could partially commit.

create or replace function public.persist_task_moves(
  p_board_id uuid,
  p_updates jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  board_project uuid;
  item jsonb;
  v_task_id uuid;
  v_position integer;
  v_status text;
  v_task_board uuid;
begin
  if p_updates is null or jsonb_typeof(p_updates) <> 'array' then
    raise exception 'p_updates must be a JSON array'
      using errcode = 'P0001';
  end if;

  select b.project_id into board_project
  from public.boards as b
  where b.id = p_board_id;

  if board_project is null then
    raise exception 'Board not found'
      using errcode = 'P0002';
  end if;

  if not public.can_edit_tasks(board_project) then
    raise exception 'Only editors can move tasks'
      using errcode = '42501';
  end if;

  for item in select * from jsonb_array_elements(p_updates)
  loop
    v_task_id := (item ->> 'id')::uuid;
    v_position := (item ->> 'position')::integer;
    v_status := item ->> 'status';

    if v_task_id is null or v_position is null or v_status is null then
      raise exception 'Each update requires id, position, and status'
        using errcode = 'P0001';
    end if;

    select t.board_id into v_task_board
    from public.tasks as t
    where t.id = v_task_id;

    if v_task_board is null then
      raise exception 'Task not found'
        using errcode = 'P0002';
    end if;

    if v_task_board <> p_board_id then
      raise exception 'Task does not belong to board'
        using errcode = 'P0001';
    end if;

    update public.tasks as t
    set
      position = v_position,
      status = v_status
    where t.id = v_task_id
      and t.board_id = p_board_id;
  end loop;
end;
$$;

revoke all on function public.persist_task_moves(uuid, jsonb) from public;
grant execute on function public.persist_task_moves(uuid, jsonb) to authenticated;
