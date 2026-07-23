-- Board-scoped sprints (ADR 0008): timebox + Task container; Commitment on Start;
-- Scope changes while Active; completion decided at Close.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.sprints (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  goal text,
  state text not null
    check (state in ('draft', 'active', 'closed', 'canceled')),
  starts_on date,
  ends_on date,
  committed_task_ids uuid[] not null default '{}'::uuid[],
  completed_task_ids uuid[] not null default '{}'::uuid[],
  started_at timestamptz,
  closed_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  constraint sprints_dates_order check (
    starts_on is null
    or ends_on is null
    or starts_on <= ends_on
  ),
  constraint sprints_active_requires_dates check (
    state <> 'active'
    or (starts_on is not null and ends_on is not null)
  )
);

create unique index if not exists sprints_one_active_per_board_idx
  on public.sprints (board_id)
  where state = 'active';

create index if not exists sprints_board_state_idx
  on public.sprints (board_id, state);

create index if not exists sprints_project_id_idx
  on public.sprints (project_id);

create table if not exists public.sprint_events (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null references public.sprints (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  event_type text not null
    check (
      event_type in (
        'task_added',
        'task_removed',
        'started',
        'closed',
        'canceled'
      )
    ),
  task_id uuid references public.tasks (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sprint_events_sprint_created_idx
  on public.sprint_events (sprint_id, created_at desc);

create index if not exists sprint_events_project_id_idx
  on public.sprint_events (project_id);

alter table public.tasks
  add column if not exists sprint_id uuid references public.sprints (id) on delete set null,
  add column if not exists sprint_position integer;

create index if not exists tasks_board_sprint_position_idx
  on public.tasks (board_id, sprint_id, sprint_position)
  where archived_at is null;

create index if not exists tasks_sprint_id_idx
  on public.tasks (sprint_id)
  where sprint_id is not null;

-- ---------------------------------------------------------------------------
-- Keep sprints.project_id aligned with boards.project_id
-- ---------------------------------------------------------------------------

create or replace function public.sync_sprint_project_id()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  select b.project_id
  into new.project_id
  from public.boards as b
  where b.id = new.board_id;

  if new.project_id is null then
    raise exception 'sprints.board_id must reference an existing board'
      using errcode = '23503';
  end if;

  return new;
end;
$$;

drop trigger if exists sprints_sync_project_id on public.sprints;
create trigger sprints_sync_project_id
  before insert or update of board_id on public.sprints
  for each row
  execute function public.sync_sprint_project_id();

revoke all on function public.sync_sprint_project_id() from public;

-- ---------------------------------------------------------------------------
-- Task ↔ Sprint membership guards + auto-clear
-- ---------------------------------------------------------------------------

create or replace function public.tasks_sprint_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  sprint_board_id uuid;
  sprint_state text;
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
    select s.board_id, s.state
    into sprint_board_id, sprint_state
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

    if sprint_state not in ('draft', 'active') then
      raise exception 'Tasks can only join draft or active sprints'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_sprint_guard on public.tasks;
create trigger tasks_sprint_guard
  before update of sprint_id, sprint_position, board_id, archived_at on public.tasks
  for each row
  execute function public.tasks_sprint_guard();

create or replace function public.tasks_sprint_insert_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  sprint_board_id uuid;
  sprint_state text;
begin
  if new.sprint_id is null then
    return new;
  end if;

  if not public.can_manage_board(new.project_id) then
    raise exception 'Only managers can change sprint membership'
      using errcode = '42501';
  end if;

  select s.board_id, s.state
  into sprint_board_id, sprint_state
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

  if sprint_state not in ('draft', 'active') then
    raise exception 'Tasks can only join draft or active sprints'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_sprint_insert_guard on public.tasks;
create trigger tasks_sprint_insert_guard
  before insert on public.tasks
  for each row
  execute function public.tasks_sprint_insert_guard();

revoke all on function public.tasks_sprint_guard() from public;
revoke all on function public.tasks_sprint_insert_guard() from public;

-- Scope-change events while the sprint is still Active.
create or replace function public.tasks_sprint_scope_events()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  left_state text;
  left_project_id uuid;
  joined_state text;
  joined_project_id uuid;
begin
  if tg_op = 'UPDATE' and old.sprint_id is not distinct from new.sprint_id then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.sprint_id is not null then
    select s.state, s.project_id
    into left_state, left_project_id
    from public.sprints as s
    where s.id = old.sprint_id;

    if left_state = 'active' then
      insert into public.sprint_events (
        sprint_id,
        project_id,
        actor_id,
        event_type,
        task_id
      ) values (
        old.sprint_id,
        left_project_id,
        (select auth.uid()),
        'task_removed',
        old.id
      );
    end if;
  end if;

  if new.sprint_id is not null then
    select s.state, s.project_id
    into joined_state, joined_project_id
    from public.sprints as s
    where s.id = new.sprint_id;

    if joined_state = 'active' then
      insert into public.sprint_events (
        sprint_id,
        project_id,
        actor_id,
        event_type,
        task_id
      ) values (
        new.sprint_id,
        joined_project_id,
        (select auth.uid()),
        'task_added',
        new.id
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_sprint_scope_events on public.tasks;
create trigger tasks_sprint_scope_events
  after insert or update of sprint_id on public.tasks
  for each row
  execute function public.tasks_sprint_scope_events();

revoke all on function public.tasks_sprint_scope_events() from public;

-- ---------------------------------------------------------------------------
-- Archive: clear sprint membership (restore stays in Backlog)
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

-- ---------------------------------------------------------------------------
-- Lifecycle RPCs (atomic Start / Close / Cancel)
-- ---------------------------------------------------------------------------

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

  if exists (
    select 1
    from public.sprints as s
    where s.board_id = sprint_row.board_id
      and s.state = 'active'
  ) then
    raise exception 'Board already has an active sprint'
      using errcode = 'P0001';
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

create or replace function public.close_sprint(
  p_sprint_id uuid,
  p_completed_task_ids uuid[],
  p_carryover_sprint_id uuid default null
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
  next_pos integer;
  incomplete_id uuid;
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

  if p_carryover_sprint_id is not null then
    select * into carry_row
    from public.sprints as s
    where s.id = p_carryover_sprint_id
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
    where t.sprint_id = p_carryover_sprint_id
      and t.archived_at is null;
  end if;

  -- Close first so clearing membership does not emit Active scope events.
  update public.sprints as s
  set
    state = 'closed',
    completed_task_ids = completed,
    closed_at = now()
  where s.id = p_sprint_id
  returning * into sprint_row;

  -- Completed → Backlog (history lives on the sprint row).
  update public.tasks as t
  set
    sprint_id = null,
    sprint_position = null
  where t.sprint_id = p_sprint_id
    and t.id = any (completed);

  if p_carryover_sprint_id is null then
    update public.tasks as t
    set
      sprint_id = null,
      sprint_position = null
    where t.sprint_id = p_sprint_id
      and t.id = any (incomplete);
  else
    for incomplete_id in
      select t.id
      from public.tasks as t
      where t.id = any (incomplete)
      order by t.sprint_position nulls last, t.created_at
    loop
      next_pos := next_pos + 1;
      update public.tasks as t
      set
        sprint_id = p_carryover_sprint_id,
        sprint_position = next_pos
      where t.id = incomplete_id;
    end loop;
  end if;

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
      'carryover_sprint_id', p_carryover_sprint_id
    )
  );

  return sprint_row;
end;
$$;

create or replace function public.cancel_sprint(p_sprint_id uuid)
returns public.sprints
language plpgsql
security invoker
set search_path = ''
as $$
declare
  sprint_row public.sprints;
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
    raise exception 'Only managers can cancel a sprint'
      using errcode = '42501';
  end if;

  if sprint_row.state not in ('draft', 'active') then
    raise exception 'Only draft or active sprints can be canceled'
      using errcode = 'P0001';
  end if;

  update public.sprints as s
  set
    state = 'canceled',
    canceled_at = now()
  where s.id = p_sprint_id
  returning * into sprint_row;

  update public.tasks as t
  set
    sprint_id = null,
    sprint_position = null
  where t.sprint_id = p_sprint_id;

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
    'canceled',
    '{}'::jsonb
  );

  return sprint_row;
end;
$$;

revoke all on function public.start_sprint(uuid, date, date) from public;
revoke all on function public.close_sprint(uuid, uuid[], uuid) from public;
revoke all on function public.cancel_sprint(uuid) from public;

grant execute on function public.start_sprint(uuid, date, date) to authenticated;
grant execute on function public.close_sprint(uuid, uuid[], uuid) to authenticated;
grant execute on function public.cancel_sprint(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.sprints enable row level security;
alter table public.sprint_events enable row level security;

drop policy if exists sprints_select on public.sprints;
create policy sprints_select on public.sprints
  for select to authenticated
  using (public.can_view_project(project_id));

drop policy if exists sprints_insert on public.sprints;
create policy sprints_insert on public.sprints
  for insert to authenticated
  with check (public.can_manage_board(project_id));

drop policy if exists sprints_update on public.sprints;
create policy sprints_update on public.sprints
  for update to authenticated
  using (public.can_manage_board(project_id))
  with check (public.can_manage_board(project_id));

drop policy if exists sprints_delete on public.sprints;
create policy sprints_delete on public.sprints
  for delete to authenticated
  using (
    public.can_manage_board(project_id)
    and state = 'draft'
    and not exists (
      select 1 from public.tasks as t where t.sprint_id = sprints.id
    )
  );

drop policy if exists sprint_events_select on public.sprint_events;
create policy sprint_events_select on public.sprint_events
  for select to authenticated
  using (public.can_view_project(project_id));

-- Events are written by triggers / RPCs under the caller's role.
drop policy if exists sprint_events_insert on public.sprint_events;
create policy sprint_events_insert on public.sprint_events
  for insert to authenticated
  with check (public.can_manage_board(project_id));
