-- Link an existing root Task as a Subtask (Contributor+). Moves the child onto the Parent Board
-- and inherits draft/active Sprint like create_subtask.

create or replace function public.set_task_parent(
  p_child_id uuid,
  p_parent_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_child public.tasks%rowtype;
  v_parent public.tasks%rowtype;
  v_status text;
  v_position integer;
  v_sprint_id uuid;
  v_sprint_position integer;
begin
  select *
    into v_child
  from public.tasks as t
  where t.id = p_child_id
    and t.archived_at is null;

  if not found then
    raise exception 'Task not found'
      using errcode = 'P0002';
  end if;

  if v_child.parent_id is not null then
    raise exception 'Task already has a Parent Task'
      using errcode = 'P0001';
  end if;

  select *
    into v_parent
  from public.tasks as t
  where t.id = p_parent_id
    and t.archived_at is null;

  if not found then
    raise exception 'Parent Task not found'
      using errcode = 'P0002';
  end if;

  if not public.can_edit_tasks(v_parent.project_id) then
    raise exception 'Only editors can link a Subtask'
      using errcode = '42501';
  end if;

  select bc.id
    into v_status
  from public.board_columns as bc
  where bc.board_id = v_parent.board_id
  order by bc.position
  limit 1;

  if v_status is null then
    raise exception 'Board has no columns'
      using errcode = 'P0001';
  end if;

  select coalesce(max(t.position), -1) + 1
    into v_position
  from public.tasks as t
  where t.board_id = v_parent.board_id
    and t.status = v_status
    and t.archived_at is null;

  v_sprint_id := null;
  if v_parent.sprint_id is not null then
    select s.id
      into v_sprint_id
    from public.sprints as s
    where s.id = v_parent.sprint_id
      and s.state in ('draft', 'active');
  end if;

  if v_sprint_id is not null then
    select coalesce(max(t.sprint_position), -1) + 1
      into v_sprint_position
    from public.tasks as t
    where t.sprint_id = v_sprint_id
      and t.archived_at is null;
  end if;

  update public.tasks as t
  set
    board_id = v_parent.board_id,
    parent_id = v_parent.id,
    position = v_position,
    sprint_id = v_sprint_id,
    sprint_position = case
      when v_sprint_id is null then null
      else v_sprint_position
    end,
    status = v_status
  where t.id = v_child.id;

  insert into public.activity_log (
    task_id,
    project_id,
    user_id,
    action,
    metadata
  )
  values
    (
      v_parent.id,
      v_parent.project_id,
      (select auth.uid()),
      'updated',
      jsonb_build_object(
        'changes',
        jsonb_build_array(
          jsonb_build_object(
            'field', 'subtask',
            'from', null,
            'to', jsonb_build_object('key', v_child.task_key)
          )
        )
      )
    ),
    (
      v_child.id,
      v_child.project_id,
      (select auth.uid()),
      'updated',
      jsonb_build_object(
        'changes',
        jsonb_build_array(
          jsonb_build_object(
            'field', 'parent',
            'from', null,
            'to', jsonb_build_object('key', v_parent.task_key)
          )
        )
      )
    );
end;
$$;

revoke all on function public.set_task_parent(uuid, uuid) from public;
grant execute on function public.set_task_parent(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
