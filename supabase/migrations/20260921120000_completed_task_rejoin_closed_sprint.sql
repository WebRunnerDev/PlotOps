-- Undo "To Backlog" from a Closed Sprint report: a Task may rejoin a Closed
-- Sprint only when it is recorded in that Sprint's completed_task_ids
-- (ADR 0021 membership). Every other join still requires draft / active.

create or replace function public.tasks_sprint_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  sprint_board_id uuid;
  sprint_state text;
  sprint_completed uuid[];
begin
  if new.board_id is distinct from old.board_id then
    new.sprint_id := null;
    new.sprint_position := null;
    return new;
  end if;

  if new.sprint_id is not distinct from old.sprint_id
     and new.sprint_position is not distinct from old.sprint_position then
    return new;
  end if;

  -- Archive transition clears membership in tasks_archive_guard.
  if old.archived_at is null and new.archived_at is not null then
    return new;
  end if;

  if not public.can_manage_board(coalesce(new.project_id, old.project_id)) then
    raise exception 'Only managers can change sprint membership'
      using errcode = '42501';
  end if;

  if new.sprint_id is not null then
    select s.board_id, s.state, s.completed_task_ids
    into sprint_board_id, sprint_state, sprint_completed
    from public.sprints as s
    where s.id = new.sprint_id;

    if sprint_board_id is null then
      raise exception 'Sprint not found'
        using errcode = '23503';
    end if;

    if sprint_board_id is distinct from new.board_id then
      raise exception 'Task sprint must belong to the same board'
        using errcode = '23514';
    end if;

    if sprint_state not in ('draft', 'active')
       and not (
         sprint_state = 'closed'
         and new.id = any (coalesce(sprint_completed, '{}'::uuid[]))
       ) then
      raise exception 'Tasks can only join draft or active sprints'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;
