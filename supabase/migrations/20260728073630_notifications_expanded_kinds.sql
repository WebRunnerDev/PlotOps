-- Expand structural Notification kinds + fan-out / Watch primitives (issue #35).
-- Keeps existing status_change / assignment RPCs working.

-- ---------------------------------------------------------------------------
-- Widen notifications.kind check
-- ---------------------------------------------------------------------------

alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (
    kind in (
      'status_change',
      'assignment',
      'board_move',
      'priority_change',
      'assignee_change',
      'author_change'
    )
  );
-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.notification_watcher_kinds()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'status_change',
    'board_move',
    'priority_change',
    'assignee_change',
    'author_change'
  ]::text[];
$$;
create or replace function public.notification_always_on_kinds()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'assignment',
    'author_change'
  ]::text[];
$$;
-- ---------------------------------------------------------------------------
-- Watcher fan-out by kind (excludes actor + optional extra recipients for dedupe)
-- ---------------------------------------------------------------------------

create or replace function public.create_notifications_for_watchers(
  p_task_id uuid,
  p_project_id uuid,
  p_kind text,
  p_metadata jsonb,
  p_exclude_recipient_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  v_task_key text;
  v_task_title text;
begin
  if p_kind is null or not (p_kind = any (public.notification_watcher_kinds())) then
    return;
  end if;

  if actor is not null and public.can_edit_tasks(p_project_id) = false then
    return;
  end if;

  select t.task_key, t.title
    into v_task_key, v_task_title
  from public.tasks as t
  where t.id = p_task_id
    and t.project_id = p_project_id
  limit 1;

  if v_task_key is null or v_task_title is null then
    return;
  end if;

  insert into public.notifications (
    recipient_id,
    project_id,
    task_id,
    kind,
    task_key,
    task_title,
    metadata
  )
  select
    w.user_id,
    p_project_id,
    p_task_id,
    p_kind,
    v_task_key,
    v_task_title,
    coalesce(p_metadata, '{}'::jsonb)
  from public.task_watchers as w
  where w.task_id = p_task_id
    and (actor is null or w.user_id <> actor)
    and (
      p_exclude_recipient_ids is null
      or not (w.user_id = any (p_exclude_recipient_ids))
    );
end;
$$;
-- ---------------------------------------------------------------------------
-- Always-on Author transfer (mirrors assignment always-on)
-- ---------------------------------------------------------------------------

create or replace function public.create_notifications_for_author_change(
  p_task_id uuid,
  p_project_id uuid,
  p_recipient_id uuid,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  v_task_key text;
  v_task_title text;
begin
  if p_recipient_id is null then
    return;
  end if;

  if actor is not null and public.can_edit_tasks(p_project_id) = false then
    return;
  end if;

  if actor is not null and actor = p_recipient_id then
    return;
  end if;

  select t.task_key, t.title
    into v_task_key, v_task_title
  from public.tasks as t
  where t.id = p_task_id
    and t.project_id = p_project_id
  limit 1;

  if v_task_key is null or v_task_title is null then
    return;
  end if;

  insert into public.notifications (
    recipient_id,
    project_id,
    task_id,
    kind,
    task_key,
    task_title,
    metadata
  )
  values (
    p_recipient_id,
    p_project_id,
    p_task_id,
    'author_change',
    v_task_key,
    v_task_title,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;
-- ---------------------------------------------------------------------------
-- One round-trip: multiple kinds for one Task save (+ always-on/Watcher dedupe)
--
-- p_events: jsonb array of objects:
--   { "kind": text, "metadata": object, "recipient_id": uuid? }
-- recipient_id present → always-on insert; absent → Watcher fan-out.
-- Dedupe: always-on recipients are excluded from paired Watcher kinds:
--   assignment → assignee_change; author_change → author_change.
-- ---------------------------------------------------------------------------

create or replace function public.create_task_notifications(
  p_task_id uuid,
  p_project_id uuid,
  p_events jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  v_task_key text;
  v_task_title text;
  ev jsonb;
  v_kind text;
  v_metadata jsonb;
  v_recipient uuid;
  always_on_assignment_recipients uuid[] := '{}'::uuid[];
  always_on_author_recipients uuid[] := '{}'::uuid[];
  exclude_ids uuid[];
begin
  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    return;
  end if;

  if actor is not null and public.can_edit_tasks(p_project_id) = false then
    return;
  end if;

  select t.task_key, t.title
    into v_task_key, v_task_title
  from public.tasks as t
  where t.id = p_task_id
    and t.project_id = p_project_id
  limit 1;

  if v_task_key is null or v_task_title is null then
    return;
  end if;

  -- Pass 1: always-on rows (recipient_id set)
  for ev in
    select value
    from jsonb_array_elements(p_events) as t(value)
  loop
    v_kind := ev ->> 'kind';
    v_metadata := coalesce(ev -> 'metadata', '{}'::jsonb);
    v_recipient := nullif(ev ->> 'recipient_id', '')::uuid;

    if v_recipient is null then
      continue;
    end if;

    if v_kind is null
       or not (v_kind = any (public.notification_always_on_kinds())) then
      continue;
    end if;

    if actor is not null and actor = v_recipient then
      continue;
    end if;

    insert into public.notifications (
      recipient_id,
      project_id,
      task_id,
      kind,
      task_key,
      task_title,
      metadata
    )
    values (
      v_recipient,
      p_project_id,
      p_task_id,
      v_kind,
      v_task_key,
      v_task_title,
      v_metadata
    );

    if v_kind = 'assignment' then
      always_on_assignment_recipients :=
        array_append(always_on_assignment_recipients, v_recipient);
    elsif v_kind = 'author_change' then
      always_on_author_recipients :=
        array_append(always_on_author_recipients, v_recipient);
    end if;
  end loop;

  -- Pass 2: Watcher fan-out (no recipient_id)
  for ev in
    select value
    from jsonb_array_elements(p_events) as t(value)
  loop
    v_kind := ev ->> 'kind';
    v_metadata := coalesce(ev -> 'metadata', '{}'::jsonb);
    v_recipient := nullif(ev ->> 'recipient_id', '')::uuid;

    if v_recipient is not null then
      continue;
    end if;

    if v_kind is null
       or not (v_kind = any (public.notification_watcher_kinds())) then
      continue;
    end if;

    exclude_ids := coalesce(
      case
        when v_kind = 'assignee_change' then always_on_assignment_recipients
        when v_kind = 'author_change' then always_on_author_recipients
        else '{}'::uuid[]
      end,
      '{}'::uuid[]
    );

    insert into public.notifications (
      recipient_id,
      project_id,
      task_id,
      kind,
      task_key,
      task_title,
      metadata
    )
    select
      w.user_id,
      p_project_id,
      p_task_id,
      v_kind,
      v_task_key,
      v_task_title,
      v_metadata
    from public.task_watchers as w
    where w.task_id = p_task_id
      and (actor is null or w.user_id <> actor)
      and not (w.user_id = any (exclude_ids));
  end loop;
end;
$$;
-- ---------------------------------------------------------------------------
-- Auto-enroll Watch on Author set/transfer (mirror Assignee enrollment)
-- Auto-Unwatch when user is neither Author nor Assignee after a change
-- ---------------------------------------------------------------------------

create or replace function public.task_watchers_on_task_stake_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Auto-enroll new Author
  if new.author_id is not null
     and (old.author_id is distinct from new.author_id) then
    insert into public.task_watchers (task_id, project_id, user_id)
    values (new.id, new.project_id, new.author_id)
    on conflict do nothing;
  end if;

  -- Auto-enroll new Assignee
  if new.assignee_id is not null
     and (old.assignee_id is distinct from new.assignee_id) then
    insert into public.task_watchers (task_id, project_id, user_id)
    values (new.id, new.project_id, new.assignee_id)
    on conflict do nothing;
  end if;

  -- Auto-Unwatch previous Author when they no longer hold Author or Assignee
  if old.author_id is not null
     and (old.author_id is distinct from new.author_id)
     and (old.author_id is distinct from new.assignee_id) then
    delete from public.task_watchers tw
    where tw.task_id = new.id
      and tw.user_id = old.author_id;
  end if;

  -- Auto-Unwatch previous Assignee when they no longer hold Author or Assignee
  if old.assignee_id is not null
     and (old.assignee_id is distinct from new.assignee_id)
     and (old.assignee_id is distinct from new.author_id) then
    delete from public.task_watchers tw
    where tw.task_id = new.id
      and tw.user_id = old.assignee_id;
  end if;

  return new;
end;
$$;
drop trigger if exists task_watchers_on_task_assignee_update on public.tasks;
drop function if exists public.task_watchers_on_task_assignee_update();
drop trigger if exists task_watchers_on_task_stake_update on public.tasks;
create trigger task_watchers_on_task_stake_update
  after update of author_id, assignee_id on public.tasks
  for each row
  execute function public.task_watchers_on_task_stake_update();
-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.notification_watcher_kinds() from public;
revoke all on function public.notification_always_on_kinds() from public;
revoke all on function public.create_notifications_for_watchers(uuid, uuid, text, jsonb, uuid[]) from public;
revoke all on function public.create_notifications_for_author_change(uuid, uuid, uuid, jsonb) from public;
revoke all on function public.create_task_notifications(uuid, uuid, jsonb) from public;
grant execute on function public.create_notifications_for_watchers(uuid, uuid, text, jsonb, uuid[]) to authenticated;
grant execute on function public.create_notifications_for_author_change(uuid, uuid, uuid, jsonb) to authenticated;
grant execute on function public.create_task_notifications(uuid, uuid, jsonb) to authenticated;
notify pgrst, 'reload schema';
