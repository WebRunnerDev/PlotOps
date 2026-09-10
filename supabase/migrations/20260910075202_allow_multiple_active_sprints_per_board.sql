-- Parallel Active Sprints on one Board (ADR 0030).
-- Drop the one-Active-per-Board unique index and allow start_sprint while
-- other Sprints on the same Board are already Active.

drop index if exists public.sprints_one_active_per_board_idx;

create or replace function public.start_sprint(
  p_sprint_id uuid,
  p_starts_on date,
  p_ends_on date
)
returns public.sprints
language plpgsql
security invoker
set search_path = ''
as $$
declare
  sprint_row public.sprints;
  committed uuid[];
begin
  select * into sprint_row
  from public.sprints as s
  where s.id = p_sprint_id
  for update;

  if not found then
    raise exception 'Sprint not found'
      using errcode = 'P0002';
  end if;

  if not public.can_manage_board(sprint_row.project_id) then
    raise exception 'Only managers can start a sprint'
      using errcode = '42501';
  end if;

  if sprint_row.state <> 'draft' then
    raise exception 'Only draft sprints can be started'
      using errcode = 'P0001';
  end if;

  if p_starts_on is null or p_ends_on is null or p_starts_on > p_ends_on then
    raise exception 'Active sprint requires valid start and end dates'
      using errcode = '23514';
  end if;

  select coalesce(array_agg(t.id order by t.sprint_position nulls last, t.created_at), '{}'::uuid[])
  into committed
  from public.tasks as t
  where t.sprint_id = p_sprint_id
    and t.archived_at is null;

  update public.sprints as s
  set
    state = 'active',
    starts_on = p_starts_on,
    ends_on = p_ends_on,
    committed_task_ids = committed,
    started_at = now(),
    completed_task_ids = '{}'::uuid[],
    closed_at = null,
    canceled_at = null
  where s.id = p_sprint_id
  returning * into sprint_row;

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
    'started',
    jsonb_build_object(
      'committed_count', coalesce(cardinality(committed), 0),
      'starts_on', p_starts_on,
      'ends_on', p_ends_on
    )
  );

  return sprint_row;
end;
$$;
