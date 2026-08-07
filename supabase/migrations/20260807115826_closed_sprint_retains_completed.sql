-- ADR 0021: on Close, completed Tasks remain members of the Closed Sprint.
-- Incomplete still Carryover (Backlog / Draft). FK ON DELETE SET NULL
-- already releases members when Closed history is deleted.

create or replace function public.close_sprint(
  p_sprint_id uuid,
  p_completed_task_ids uuid[],
  p_carryover_by_task_id jsonb default '{}'::jsonb
)
returns public.sprints
language plpgsql
security invoker
set search_path = ''
as $$
declare
  sprint_row public.sprints;
  carry_row public.sprints;
  completed uuid[] := coalesce(p_completed_task_ids, '{}'::uuid[]);
  member_ids uuid[];
  incomplete uuid[];
  incomplete_id uuid;
  target_id uuid;
  carryover_map jsonb := coalesce(p_carryover_by_task_id, '{}'::jsonb);
  carryover_payload jsonb := '{}'::jsonb;
  next_pos_by_sprint jsonb := '{}'::jsonb;
  next_pos integer;
  distinct_target uuid;
begin
  if jsonb_typeof(carryover_map) <> 'object' then
    raise exception 'p_carryover_by_task_id must be a JSON object'
      using errcode = 'P0001';
  end if;

  select * into sprint_row
  from public.sprints as s
  where s.id = p_sprint_id
  for update;

  if not found then
    raise exception 'Sprint not found'
      using errcode = 'P0002';
  end if;

  if not public.can_manage_board(sprint_row.project_id) then
    raise exception 'Only managers can close a sprint'
      using errcode = '42501';
  end if;

  if sprint_row.state <> 'active' then
    raise exception 'Only active sprints can be closed'
      using errcode = 'P0001';
  end if;

  select coalesce(array_agg(t.id), '{}'::uuid[])
  into member_ids
  from public.tasks as t
  where t.sprint_id = p_sprint_id
    and t.archived_at is null;

  -- Keep only completed ids that are still members.
  select coalesce(array_agg(x), '{}'::uuid[])
  into completed
  from unnest(completed) as x
  where x = any (member_ids);

  select coalesce(array_agg(m), '{}'::uuid[])
  into incomplete
  from unnest(member_ids) as m
  where not (m = any (completed));

  -- Validate all distinct non-null carryover targets used by incomplete tasks.
  for distinct_target in
    select distinct nullif(carryover_map ->> member_id::text, '')::uuid
    from unnest(incomplete) as member_id
    where carryover_map ? member_id::text
      and jsonb_typeof(carryover_map -> member_id::text) <> 'null'
      and nullif(carryover_map ->> member_id::text, '') is not null
  loop
    select * into carry_row
    from public.sprints as s
    where s.id = distinct_target
    for update;

    if not found then
      raise exception 'Carryover sprint not found'
        using errcode = 'P0002';
    end if;

    if carry_row.board_id is distinct from sprint_row.board_id then
      raise exception 'Carryover sprint must be on the same board'
        using errcode = '23514';
    end if;

    if carry_row.state <> 'draft' then
      raise exception 'Carryover target must be a draft sprint'
        using errcode = '23514';
    end if;

    select coalesce(max(t.sprint_position), -1)
    into next_pos
    from public.tasks as t
    where t.sprint_id = distinct_target
      and t.archived_at is null;

    next_pos_by_sprint := next_pos_by_sprint || jsonb_build_object(
      distinct_target::text,
      next_pos
    );
  end loop;

  -- Close first so clearing incomplete membership does not emit Active
  -- scope events.
  update public.sprints as s
  set
    state = 'closed',
    completed_task_ids = completed,
    closed_at = now()
  where s.id = p_sprint_id
  returning * into sprint_row;

  -- Completed retain sprint_id (Closed Sprint membership — ADR 0021).

  for incomplete_id in
    select t.id
    from public.tasks as t
    where t.id = any (incomplete)
    order by t.sprint_position nulls last, t.created_at
  loop
    target_id := null;
    if
      carryover_map ? incomplete_id::text
      and jsonb_typeof(carryover_map -> incomplete_id::text) <> 'null'
    then
      target_id := nullif(carryover_map ->> incomplete_id::text, '')::uuid;
    end if;

    carryover_payload := carryover_payload || jsonb_build_object(
      incomplete_id::text,
      to_jsonb(target_id)
    );

    if target_id is null then
      update public.tasks as t
      set
        sprint_id = null,
        sprint_position = null
      where t.id = incomplete_id;
    else
      next_pos := coalesce(
        (next_pos_by_sprint ->> target_id::text)::integer,
        -1
      ) + 1;
      next_pos_by_sprint := next_pos_by_sprint || jsonb_build_object(
        target_id::text,
        next_pos
      );

      update public.tasks as t
      set
        sprint_id = target_id,
        sprint_position = next_pos
      where t.id = incomplete_id;
    end if;
  end loop;

  insert into public.sprint_events (
    sprint_id,
    project_id,
    actor_id,
    event_type,
    payload
  ) values (
    p_sprint_id,
    sprint_row.project_id,
    (select auth.uid()),
    'closed',
    jsonb_build_object(
      'committed_count', coalesce(cardinality(sprint_row.committed_task_ids), 0),
      'completed_count', coalesce(cardinality(completed), 0),
      'incomplete_count', coalesce(cardinality(incomplete), 0),
      'carryover_by_task_id', carryover_payload
    )
  );

  return sprint_row;
end;
$$;
