-- Atomic column delete: remap active tasks then delete in one transaction.

create or replace function public.delete_board_column(
  p_board_id uuid,
  p_column_id text,
  p_move_tasks_to text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  board_project uuid;
  column_exists boolean;
  target_exists boolean;
  remaining_count integer;
begin
  select b.project_id into board_project
  from public.boards as b
  where b.id = p_board_id;

  if board_project is null then
    raise exception 'Board not found'
      using errcode = 'P0002';
  end if;

  if not public.can_manage_board(board_project) then
    raise exception 'Only managers can delete columns'
      using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.board_columns as bc
    where bc.board_id = p_board_id
      and bc.id = p_column_id
  ) into column_exists;

  if not column_exists then
    raise exception 'Column not found'
      using errcode = 'P0002';
  end if;

  select count(*)::integer into remaining_count
  from public.board_columns as bc
  where bc.board_id = p_board_id;

  if remaining_count <= 1 then
    raise exception 'Cannot delete the last column'
      using errcode = 'P0001';
  end if;

  if p_move_tasks_to is not null then
    if p_move_tasks_to = p_column_id then
      raise exception 'Cannot move tasks onto the column being deleted'
        using errcode = 'P0001';
    end if;

    select exists (
      select 1
      from public.board_columns as bc
      where bc.board_id = p_board_id
        and bc.id = p_move_tasks_to
    ) into target_exists;

    if not target_exists then
      raise exception 'Target column not found'
        using errcode = 'P0002';
    end if;

    update public.tasks as t
    set status = p_move_tasks_to
    where t.board_id = p_board_id
      and t.status = p_column_id
      and t.archived_at is null;
  end if;

  delete from public.board_columns as bc
  where bc.board_id = p_board_id
    and bc.id = p_column_id;
end;
$$;

revoke all on function public.delete_board_column(uuid, text, text) from public;
grant execute on function public.delete_board_column(uuid, text, text) to authenticated;
