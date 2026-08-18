-- Per-board: assign new Tasks to the creator when the Team is a single person.
alter table public.boards
  add column if not exists auto_assign_to_creator boolean not null default false;

create or replace function public.create_subtask(
  p_parent_id uuid,
  p_title text,
  p_task_type public.task_type default null,
  p_sprint_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_parent public.tasks%rowtype;
  v_status text;
  v_task_type public.task_type;
  v_position integer;
  v_sprint_id uuid;
  v_sprint_position integer;
  v_id uuid;
  v_key text;
  v_auto_assign boolean;
  v_people integer;
  v_assignee uuid;
begin
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
    raise exception 'Only editors can create a Subtask'
      using errcode = '42501';
  end if;

  if v_parent.parent_id is not null then
    raise exception 'A Subtask cannot have Subtasks'
      using errcode = 'P0001';
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

  v_task_type := coalesce(p_task_type, 'task'::public.task_type);

  select coalesce(max(t.position), -1) + 1
    into v_position
  from public.tasks as t
  where t.board_id = v_parent.board_id
    and t.status = v_status
    and t.archived_at is null;

  v_sprint_id := p_sprint_id;
  if v_sprint_id is null and v_parent.sprint_id is not null then
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

  select b.auto_assign_to_creator
    into v_auto_assign
  from public.boards as b
  where b.id = v_parent.board_id;

  if coalesce(v_auto_assign, false) then
    select
      (case when t.owner_id is not null then 1 else 0 end)
      + (
        select count(*)::integer
        from public.team_members as m
        where m.team_id = t.id
      )
      into v_people
    from public.teams as t
    where t.id = public.project_team_id(v_parent.project_id);

    if v_people = 1 then
      v_assignee := (select auth.uid());
    end if;
  end if;

  insert into public.tasks (
    assignee_id,
    author_id,
    board_id,
    parent_id,
    position,
    priority,
    project_id,
    sprint_id,
    sprint_position,
    status,
    task_type,
    title
  )
  values (
    v_assignee,
    (select auth.uid()),
    v_parent.board_id,
    v_parent.id,
    v_position,
    'medium',
    v_parent.project_id,
    v_sprint_id,
    v_sprint_position,
    v_status,
    v_task_type,
    btrim(p_title)
  )
  returning id, task_key into v_id, v_key;

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
            'to', jsonb_build_object('key', v_key)
          )
        )
      )
    ),
    (
      v_id,
      v_parent.project_id,
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

  return v_id;
end;
$$;

revoke all on function public.create_subtask(uuid, text, public.task_type, uuid) from public;
grant execute on function public.create_subtask(uuid, text, public.task_type, uuid) to authenticated;

notify pgrst, 'reload schema';
