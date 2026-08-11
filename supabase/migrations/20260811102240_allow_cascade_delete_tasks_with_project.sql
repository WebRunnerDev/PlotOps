-- Project DELETE cascades to tasks. tasks_require_archived_before_delete used
-- to block that path ("Archive the task before deleting") for any active Task.
-- Skip the archive-before-delete guard when the parent Project no longer exists
-- (same CASCADE pattern as guard_last_board).

create or replace function public.tasks_require_archived_before_delete()
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

  if old.archived_at is null then
    raise exception 'Archive the task before deleting'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;
