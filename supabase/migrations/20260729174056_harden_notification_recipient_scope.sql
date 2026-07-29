-- Harden always-on notification fan-out: only project participants may be
-- recipients. Mentions already enforced this; assignment / author_change /
-- create_task_notifications did not, allowing cross-project disclosure via
-- caller-supplied recipient_id.

-- ---------------------------------------------------------------------------
-- Helper: is this user owner or member of the project?
-- ---------------------------------------------------------------------------

create or replace function public.is_project_participant(
  p_project_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select
    p_user_id is not null
    and (
      exists (
        select 1
        from public.projects as p
        where p.id = p_project_id
          and p.owner_id = p_user_id
      )
      or exists (
        select 1
        from public.project_members as m
        where m.project_id = p_project_id
          and m.user_id = p_user_id
      )
    );
$$;

revoke all on function public.is_project_participant(uuid, uuid) from public;
revoke all on function public.is_project_participant(uuid, uuid) from anon;
grant execute on function public.is_project_participant(uuid, uuid) to authenticated;
grant execute on function public.is_project_participant(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- create_notifications_for_assignment_change
-- ---------------------------------------------------------------------------

create or replace function public.create_notifications_for_assignment_change(
  p_task_id uuid,
  p_project_id uuid,
  p_recipient_id uuid,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path to ''
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

  -- self-notify exclusion
  if actor is not null and actor = p_recipient_id then
    return;
  end if;

  if public.is_project_participant(p_project_id, p_recipient_id) = false then
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
    'assignment',
    v_task_key,
    v_task_title,
    p_metadata
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- create_notifications_for_author_change
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
set search_path to ''
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

  if public.is_project_participant(p_project_id, p_recipient_id) = false then
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
-- create_task_notifications (always-on pass)
-- ---------------------------------------------------------------------------

create or replace function public.create_task_notifications(
  p_task_id uuid,
  p_project_id uuid,
  p_events jsonb
)
returns void
language plpgsql
security definer
set search_path to ''
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

  -- Pass 1: always-on rows (recipient_id set). Mentions use dedicated RPC.
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
       or v_kind = 'mention'
       or not (v_kind = any (public.notification_always_on_kinds())) then
      continue;
    end if;

    if actor is not null and actor = v_recipient then
      continue;
    end if;

    if public.is_project_participant(p_project_id, v_recipient) = false then
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

-- Align grants with other PlotOps RPCs (no anon execute).
revoke all on function public.create_notifications_for_assignment_change(uuid, uuid, uuid, jsonb) from public;
revoke all on function public.create_notifications_for_assignment_change(uuid, uuid, uuid, jsonb) from anon;
revoke all on function public.create_notifications_for_author_change(uuid, uuid, uuid, jsonb) from public;
revoke all on function public.create_notifications_for_author_change(uuid, uuid, uuid, jsonb) from anon;
revoke all on function public.create_task_notifications(uuid, uuid, jsonb) from public;
revoke all on function public.create_task_notifications(uuid, uuid, jsonb) from anon;

grant execute on function public.create_notifications_for_assignment_change(uuid, uuid, uuid, jsonb) to authenticated;
grant execute on function public.create_notifications_for_assignment_change(uuid, uuid, uuid, jsonb) to service_role;

grant execute on function public.create_notifications_for_author_change(uuid, uuid, uuid, jsonb) to authenticated;
grant execute on function public.create_notifications_for_author_change(uuid, uuid, uuid, jsonb) to service_role;

grant execute on function public.create_task_notifications(uuid, uuid, jsonb) to authenticated;
grant execute on function public.create_task_notifications(uuid, uuid, jsonb) to service_role;

notify pgrst, 'reload schema';
