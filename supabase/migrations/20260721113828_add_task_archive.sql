-- Soft-archive for tasks (free-tier friendly): stay in `tasks`, hide from board.

alter table public.tasks
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles (id) on delete set null;

create index if not exists tasks_board_active_status_position_idx
  on public.tasks (board_id, status, position)
  where archived_at is null;

create index if not exists tasks_board_archived_at_idx
  on public.tasks (board_id, archived_at desc)
  where archived_at is not null;

create index if not exists tasks_archived_by_idx
  on public.tasks (archived_by)
  where archived_by is not null;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.task_is_archived(task_uuid uuid)
returns boolean
language sql
security invoker
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.tasks as t
    where t.id = task_uuid
      and t.archived_at is not null
  );
$$;

create or replace function public.assert_task_not_archived(task_uuid uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if public.task_is_archived(task_uuid) then
    raise exception 'Task is archived and cannot be modified'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.task_is_archived(uuid) from public;
revoke all on function public.assert_task_not_archived(uuid) from public;
grant execute on function public.task_is_archived(uuid) to authenticated;
grant execute on function public.assert_task_not_archived(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- tasks: attribution + permission + freeze
-- ---------------------------------------------------------------------------

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
begin
  -- Archive / restore: Admin + Manager only; DB owns timestamps + actor.
  if is_archive_transition then
    if not public.can_delete_tasks(old.project_id) then
      raise exception 'Only managers can archive tasks'
        using errcode = '42501';
    end if;
    new.archived_at := now();
    new.archived_by := (select auth.uid());
    return new;
  end if;

  if is_restore_transition then
    if not public.can_delete_tasks(old.project_id) then
      raise exception 'Only managers can restore tasks'
        using errcode = '42501';
    end if;
    new.archived_at := null;
    new.archived_by := null;
    return new;
  end if;

  -- Stay archived: reject content edits; allow status/position for column ops.
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

  -- Active task: never trust client-supplied archived_by.
  new.archived_by := null;
  new.archived_at := null;
  return new;
end;
$$;

drop trigger if exists tasks_archive_guard on public.tasks;
create trigger tasks_archive_guard
  before update on public.tasks
  for each row
  execute function public.tasks_archive_guard();

-- Hard delete only after archive (matches product: delete from archive list).
create or replace function public.tasks_require_archived_before_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.archived_at is null then
    raise exception 'Archive the task before deleting'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists tasks_require_archived_before_delete on public.tasks;
create trigger tasks_require_archived_before_delete
  before delete on public.tasks
  for each row
  execute function public.tasks_require_archived_before_delete();

-- ---------------------------------------------------------------------------
-- Side tables: no writes while parent task is archived
-- ---------------------------------------------------------------------------

create or replace function public.task_comments_reject_if_archived()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_task_id uuid := coalesce(new.task_id, old.task_id);
begin
  perform public.assert_task_not_archived(target_task_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists task_comments_reject_if_archived on public.task_comments;
create trigger task_comments_reject_if_archived
  before insert or update or delete on public.task_comments
  for each row
  execute function public.task_comments_reject_if_archived();

create or replace function public.task_labels_reject_if_archived()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_task_id uuid := coalesce(new.task_id, old.task_id);
begin
  perform public.assert_task_not_archived(target_task_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists task_labels_reject_if_archived on public.task_labels;
create trigger task_labels_reject_if_archived
  before insert or update or delete on public.task_labels
  for each row
  execute function public.task_labels_reject_if_archived();

notify pgrst, 'reload schema';
