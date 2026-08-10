-- Project DELETE cascades to boards. guard_last_board used to block that
-- path ("Cannot delete the last board in a project") because ON DELETE CASCADE
-- fires AFTER the parent projects row is gone — count still sees 1 board.
-- Skip last-board / has-tasks guards when the parent Project no longer exists.

create or replace function public.guard_last_board()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- CASCADE from projects DELETE: parent row is already gone.
  if not exists (
    select 1 from public.projects as p where p.id = old.project_id
  ) then
    return old;
  end if;

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
