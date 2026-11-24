-- Status history for flow reports (Cumulative flow, Cycle time — STORY-160).
--
-- `activity_log` is a best-effort context feed written by each client: the
-- MCP worker (`change_task_status`) and Subtasks moved along with their
-- Parent Task never write it, and a failed insert is swallowed. Flow reports
-- need every column change, so a trigger on `tasks` records them here,
-- whichever path changed the status: Kanban drag, Task drawer, MCP, the
-- GitHub merge sync, a Board move or a restore from archive.
--
-- 1. `task_status_changes`: one row per status / Board change. A row with
--    `from_status` null is the Task's creation. Column names are snapshots,
--    so history from another Board can be mapped onto the current Board's
--    columns by name.
-- 2. Backfill from `activity_log` status changes (history before this table).
-- 3. `get_board_flow_history`: one round trip with a Board's Tasks and the
--    status changes the reports need, as jsonb (no PostgREST row cap).

create table if not exists public.task_status_changes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  -- Board the Task was on after the change.
  board_id uuid not null references public.boards (id) on delete cascade,
  from_status text,
  from_status_name text,
  to_status text not null,
  to_status_name text,
  changed_at timestamptz not null default now(),
  source text not null default 'trigger',
  constraint task_status_changes_source_check
    check (source in ('trigger', 'activity_log'))
);

comment on table public.task_status_changes is
  'Task column history for flow reports. Written by trigger only; from_status null = creation.';

create index if not exists task_status_changes_task_changed_idx
  on public.task_status_changes (task_id, changed_at);

create index if not exists task_status_changes_board_changed_idx
  on public.task_status_changes (board_id, changed_at);

create index if not exists task_status_changes_project_idx
  on public.task_status_changes (project_id);

alter table public.task_status_changes enable row level security;

drop policy if exists "task_status_changes_select_member"
  on public.task_status_changes;

create policy "task_status_changes_select_member"
  on public.task_status_changes
  for select
  to authenticated
  using (public.can_view_project(project_id));

-- No insert / update / delete policies: only the trigger below writes.
revoke all on table public.task_status_changes from public, anon, authenticated;
grant select on public.task_status_changes to authenticated;
grant select, insert, update, delete on public.task_status_changes to service_role;

-- ---------------------------------------------------------------------------
-- 1. Trigger
-- ---------------------------------------------------------------------------

create or replace function public.record_task_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and new.status is not distinct from old.status
    and new.board_id is not distinct from old.board_id then
    return null;
  end if;

  insert into public.task_status_changes (
    task_id,
    project_id,
    board_id,
    from_status,
    from_status_name,
    to_status,
    to_status_name
  )
  values (
    new.id,
    new.project_id,
    new.board_id,
    case when tg_op = 'UPDATE' then old.status end,
    case
      when tg_op = 'UPDATE' then (
        select bc.name
        from public.board_columns as bc
        where bc.board_id = old.board_id
          and bc.id = old.status
      )
    end,
    new.status,
    (
      select bc.name
      from public.board_columns as bc
      where bc.board_id = new.board_id
        and bc.id = new.status
    )
  );

  return null;
end;
$$;

revoke all on function public.record_task_status_change() from public;
revoke all on function public.record_task_status_change() from anon;
revoke all on function public.record_task_status_change() from authenticated;

drop trigger if exists tasks_record_status_change on public.tasks;

create trigger tasks_record_status_change
  after insert or update of status, board_id on public.tasks
  for each row
  execute function public.record_task_status_change();

-- ---------------------------------------------------------------------------
-- 2. Backfill from activity_log (client + webhook status changes)
-- ---------------------------------------------------------------------------

-- Logged snapshots are `{ id, name }`; seeded rows may carry only a name, so
-- a missing id is resolved by column name on the Task's current Board.
with logged as (
  select
    a.task_id,
    a.created_at,
    t.project_id,
    t.board_id,
    change -> 'from' as from_snapshot,
    change -> 'to' as to_snapshot
  from public.activity_log as a
  join public.tasks as t
    on t.id = a.task_id
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(a.metadata -> 'changes') = 'array'
        then a.metadata -> 'changes'
      else '[]'::jsonb
    end
  ) as change
  where change ->> 'field' = 'status'
    and jsonb_typeof(change -> 'from') = 'object'
    and jsonb_typeof(change -> 'to') = 'object'
),
resolved as (
  select
    l.task_id,
    l.created_at,
    l.project_id,
    l.board_id,
    coalesce(
      nullif(l.from_snapshot ->> 'id', ''),
      (
        select bc.id
        from public.board_columns as bc
        where bc.board_id = l.board_id
          and lower(btrim(bc.name)) = lower(btrim(l.from_snapshot ->> 'name'))
        order by bc.position
        limit 1
      )
    ) as from_status,
    l.from_snapshot ->> 'name' as from_status_name,
    coalesce(
      nullif(l.to_snapshot ->> 'id', ''),
      (
        select bc.id
        from public.board_columns as bc
        where bc.board_id = l.board_id
          and lower(btrim(bc.name)) = lower(btrim(l.to_snapshot ->> 'name'))
        order by bc.position
        limit 1
      )
    ) as to_status,
    l.to_snapshot ->> 'name' as to_status_name
  from logged as l
)
insert into public.task_status_changes (
  task_id,
  project_id,
  board_id,
  from_status,
  from_status_name,
  to_status,
  to_status_name,
  changed_at,
  source
)
select
  r.task_id,
  r.project_id,
  r.board_id,
  r.from_status,
  r.from_status_name,
  r.to_status,
  r.to_status_name,
  r.created_at,
  'activity_log'
from resolved as r
-- A creation row (from null) is the trigger's alone.
where r.from_status is not null
  and r.to_status is not null;

-- ---------------------------------------------------------------------------
-- 3. Read RPC
-- ---------------------------------------------------------------------------

-- Tasks: every non-Epic Task on the Board, except those archived before
-- p_since. Changes: the full history of each Task that changed at or after
-- p_since (Cycle time needs the start, which may be earlier). Tasks without
-- changes in the window sat in their current column throughout.
create or replace function public.get_board_flow_history(
  p_board_id uuid,
  p_since timestamptz
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with board_tasks as (
    select
      t.id,
      t.task_key,
      t.title,
      t.status,
      t.created_at,
      t.archived_at
    from public.tasks as t
    where t.board_id = p_board_id
      and t.task_type <> 'epic'
      and (t.archived_at is null or t.archived_at >= p_since)
  ),
  moving_tasks as (
    select distinct c.task_id
    from public.task_status_changes as c
    join board_tasks as bt
      on bt.id = c.task_id
    where c.changed_at >= p_since
  )
  select jsonb_build_object(
    'tasks',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', bt.id,
            'key', bt.task_key,
            'title', bt.title,
            'status', bt.status,
            'created_at', bt.created_at,
            'archived_at', bt.archived_at
          )
        )
        from board_tasks as bt
      ),
      '[]'::jsonb
    ),
    'changes',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'task_id', c.task_id,
            'from_status', c.from_status,
            'from_status_name', c.from_status_name,
            'to_status', c.to_status,
            'to_status_name', c.to_status_name,
            'changed_at', c.changed_at
          )
          order by c.changed_at, c.id
        )
        from public.task_status_changes as c
        where c.task_id in (select mt.task_id from moving_tasks as mt)
      ),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.get_board_flow_history(uuid, timestamptz) from public;
revoke all on function public.get_board_flow_history(uuid, timestamptz) from anon;
grant execute on function public.get_board_flow_history(uuid, timestamptz) to authenticated;

notify pgrst, 'reload schema';
