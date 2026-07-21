-- On archive/restore transitions, only archive columns (+ position on restore)
-- may change; all other task fields stay as OLD.

create or replace function public.tasks_archive_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  was_archived boolean := old.archived_at is not null;
  will_archive boolean := new.archived_at is not null;
  is_archive_transition boolean := (not was_archived) and will_archive;
  is_restore_transition boolean := was_archived and (not will_archive);
  content_changed boolean;
  board_maintenance boolean;
  next_position integer;
begin
  if is_archive_transition then
    if not public.can_delete_tasks(old.project_id) then
      raise exception 'Only managers can archive tasks'
        using errcode = '42501';
    end if;

    next_position := new.position;
    new := old;
    new.position := next_position;
    new.archived_at := now();
    new.archived_by := (select auth.uid());
    return new;
  end if;

  if is_restore_transition then
    if not public.can_delete_tasks(old.project_id) then
      raise exception 'Only managers can restore tasks'
        using errcode = '42501';
    end if;

    next_position := new.position;
    new := old;
    new.position := next_position;
    new.archived_at := null;
    new.archived_by := null;
    return new;
  end if;

  if was_archived and will_archive then
    new.archived_at := old.archived_at;
    new.archived_by := old.archived_by;

    content_changed :=
      new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.priority is distinct from old.priority
      or new.deadline is distinct from old.deadline
      or new.branch_name is distinct from old.branch_name
      or new.assignee_id is distinct from old.assignee_id
      or new.author_id is distinct from old.author_id
      or new.pr_number is distinct from old.pr_number
      or new.pr_state is distinct from old.pr_state
      or new.pr_url is distinct from old.pr_url
      or new.task_type is distinct from old.task_type
      or new.board_id is distinct from old.board_id
      or new.project_id is distinct from old.project_id;

    board_maintenance :=
      new.status is distinct from old.status
      or new.position is distinct from old.position;

    if content_changed then
      raise exception 'Task is archived and cannot be modified'
        using errcode = 'P0001';
    end if;

    if board_maintenance and not public.can_manage_board(old.project_id) then
      raise exception 'Task is archived and cannot be modified'
        using errcode = 'P0001';
    end if;

    return new;
  end if;

  new.archived_by := null;
  new.archived_at := null;
  return new;
end;
$$;
