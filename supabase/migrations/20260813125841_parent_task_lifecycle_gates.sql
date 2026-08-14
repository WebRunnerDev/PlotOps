-- Parent Task Done / archive / delete gates (ADR 0023, ticket 197).
-- Server RPCs are the source of truth; a status trigger covers update/move equivalents.

create or replace function public.assert_parent_task_may_enter_done(p_task_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.tasks as child
    left join public.board_columns as col
      on col.board_id = child.board_id
     and col.id = child.status
    where child.parent_id = p_task_id
      and child.archived_at is null
      and coalesce(col.is_done, false) is not true
  ) then
    raise exception 'A Parent Task cannot enter Done while Subtasks are not Done'
      using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.assert_parent_task_may_archive(p_task_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.tasks as child
    where child.parent_id = p_task_id
      and child.archived_at is null
  ) then
    raise exception 'A Parent Task cannot be archived while Subtasks are still active'
      using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.assert_parent_task_may_delete(p_task_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.tasks as child
    where child.parent_id = p_task_id
  ) then
    raise exception 'A Parent Task cannot be deleted while Subtasks exist'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.assert_parent_task_may_enter_done(uuid) from public;
grant execute on function public.assert_parent_task_may_enter_done(uuid) to authenticated;
revoke all on function public.assert_parent_task_may_archive(uuid) from public;
grant execute on function public.assert_parent_task_may_archive(uuid) to authenticated;
revoke all on function public.assert_parent_task_may_delete(uuid) from public;
grant execute on function public.assert_parent_task_may_delete(uuid) to authenticated;

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
  v_old_status text;
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

    select t.board_id, t.status
      into v_task_board, v_old_status
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

    if v_old_status is distinct from v_status
       and exists (
         select 1
         from public.board_columns as bc
         where bc.board_id = p_board_id
           and bc.id = v_status
           and bc.is_done
       )
    then
      perform public.assert_parent_task_may_enter_done(v_task_id);
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

create or replace function public.archive_tasks(p_task_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_project_count integer;
  v_archived_ids uuid[];
  v_count integer;
begin
  if p_task_ids is null or cardinality(p_task_ids) = 0 then
    raise exception 'p_task_ids must be a non-empty array'
      using errcode = 'P0001';
  end if;

  if cardinality(p_task_ids) > 100 then
    raise exception 'Cannot archive more than 100 tasks at once'
      using errcode = 'P0001';
  end if;

  select count(distinct t.project_id)::integer
    into v_project_count
  from public.tasks as t
  where t.id = any (p_task_ids);

  if v_project_count = 0 then
    raise exception 'Task not found'
      using errcode = 'P0002';
  end if;

  if v_project_count <> 1 then
    raise exception 'All tasks must belong to the same project'
      using errcode = 'P0001';
  end if;

  select t.project_id
    into v_project_id
  from public.tasks as t
  where t.id = any (p_task_ids)
  limit 1;

  if not public.can_delete_tasks(v_project_id) then
    raise exception 'Only managers can archive tasks'
      using errcode = '42501';
  end if;

  perform public.assert_parent_task_may_archive(t.id)
  from public.tasks as t
  where t.id = any (p_task_ids)
    and t.archived_at is null;

  with updated as (
    update public.tasks as t
    set archived_at = now()
    where t.id = any (p_task_ids)
      and t.archived_at is null
    returning t.id, t.project_id
  )
  select coalesce(array_agg(updated.id), '{}'::uuid[])
    into v_archived_ids
  from updated;

  v_count := coalesce(cardinality(v_archived_ids), 0);

  if v_count > 0 then
    insert into public.activity_log (
      task_id,
      project_id,
      user_id,
      action,
      metadata
    )
    select
      archived_id,
      v_project_id,
      (select auth.uid()),
      'updated',
      jsonb_build_object(
        'changes',
        jsonb_build_array(
          jsonb_build_object(
            'field', 'archived',
            'from', false,
            'to', true
          )
        )
      )
    from unnest(v_archived_ids) as archived_id;
  end if;

  return v_count;
end;
$$;

revoke all on function public.archive_tasks(uuid[]) from public;
grant execute on function public.archive_tasks(uuid[]) to authenticated;

create or replace function public.tasks_parent_done_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if exists (
    select 1
    from public.board_columns as bc
    where bc.board_id = new.board_id
      and bc.id = new.status
      and bc.is_done
  ) then
    perform public.assert_parent_task_may_enter_done(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_parent_done_guard on public.tasks;
create trigger tasks_parent_done_guard
  before update of status on public.tasks
  for each row
  execute function public.tasks_parent_done_guard();

revoke all on function public.tasks_parent_done_guard() from public;

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

    perform public.assert_parent_task_may_archive(old.id);

    next_position := new.position;
    new := old;
    new.position := next_position;
    new.archived_at := now();
    new.archived_by := (select auth.uid());
    new.sprint_id := null;
    new.sprint_position := null;
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
    -- Keep sprint_id cleared (Backlog); do not rejoin a Sprint.
    new.sprint_id := null;
    new.sprint_position := null;
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
      or new.project_id is distinct from old.project_id
      or new.sprint_id is distinct from old.sprint_id
      or new.sprint_position is distinct from old.sprint_position;

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

  perform public.assert_parent_task_may_delete(old.id);

  if old.archived_at is null then
    raise exception 'Archive the task before deleting'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;
