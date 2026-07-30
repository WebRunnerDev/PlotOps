-- Harden task_watchers: bind task_id to project_id.
--
-- Insert RLS previously allowed any task_id as long as project_id was viewable,
-- so a member of Project A could watch a task from Project B (using A's
-- project_id) and receive fan-out notifications keyed only by task_id.

-- ---------------------------------------------------------------------------
-- Remove any already-mismatched rows (integrity before FK)
-- ---------------------------------------------------------------------------

delete from public.task_watchers as tw
where not exists (
  select 1
  from public.tasks as t
  where t.id = tw.task_id
    and t.project_id = tw.project_id
);

-- ---------------------------------------------------------------------------
-- Composite FK: task_watchers.(task_id, project_id) → tasks.(id, project_id)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_id_project_id_key'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_id_project_id_key unique (id, project_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'task_watchers_task_project_fkey'
      and conrelid = 'public.task_watchers'::regclass
  ) then
    alter table public.task_watchers
      add constraint task_watchers_task_project_fkey
      foreign key (task_id, project_id)
      references public.tasks (id, project_id)
      on delete cascade;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: require task_id to belong to the same project_id
-- ---------------------------------------------------------------------------

drop policy if exists "task_watchers_insert_self_only" on public.task_watchers;
create policy "task_watchers_insert_self_only"
  on public.task_watchers
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.can_view_project(project_id)
    and exists (
      select 1
      from public.tasks as t
      where t.id = task_id
        and t.project_id = project_id
    )
  );

drop policy if exists "task_watchers_delete_self_only" on public.task_watchers;
create policy "task_watchers_delete_self_only"
  on public.task_watchers
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and public.can_view_project(project_id)
    and exists (
      select 1
      from public.tasks as t
      where t.id = task_id
        and t.project_id = project_id
    )
  );

-- ---------------------------------------------------------------------------
-- Fan-out defense in depth: match watchers by task_id AND project_id
-- ---------------------------------------------------------------------------

create or replace function public.create_notifications_for_status_change(
  p_task_id uuid,
  p_project_id uuid,
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
    'status_change',
    v_task_key,
    v_task_title,
    p_metadata
  from public.task_watchers as w
  where w.task_id = p_task_id
    and w.project_id = p_project_id
    and (actor is null or w.user_id <> actor);
end;
$$;

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
    and w.project_id = p_project_id
    and (actor is null or w.user_id <> actor)
    and (
      p_exclude_recipient_ids is null
      or not (w.user_id = any (p_exclude_recipient_ids))
    );
end;
$$;

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
      and w.project_id = p_project_id
      and (actor is null or w.user_id <> actor)
      and not (w.user_id = any (exclude_ids));
  end loop;
end;
$$;

notify pgrst, 'reload schema';
