-- Mention always-on Notification kind + fan-out RPC (issue #41 / ADR 0014).
-- Does not auto-enroll Watch. Membership validated at write time.

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
      'deadline_change',
      'assignee_change',
      'author_change',
      'mention'
    )
  );
-- ---------------------------------------------------------------------------
-- Always-on kinds (mention uses dedicated RPC; listed for completeness)
-- ---------------------------------------------------------------------------

create or replace function public.notification_always_on_kinds()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'assignment',
    'author_change',
    'mention'
  ]::text[];
$$;
revoke all on function public.notification_always_on_kinds() from public;
grant execute on function public.notification_always_on_kinds() to authenticated;
-- ---------------------------------------------------------------------------
-- Search phrases for mention kind (inbox FTS)
-- ---------------------------------------------------------------------------

create or replace function public.notification_kind_search_text(p_kind text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_kind
    when 'assignment' then
      'assignment assigned assignee you were assigned assigned to назначен вас назначили исполнителем'
    when 'assignee_change' then
      'assignee change assignee changed assignee set to исполнитель изменён исполнитель'
    when 'author_change' then
      'author change author changed author set to автор изменён автор'
    when 'board_move' then
      'board move moved to another board перенесена на другую доску'
    when 'deadline_change' then
      'deadline change deadline changed deadline set deadline cleared дедлайн изменён дедлайн снят дедлайн установлен'
    when 'mention' then
      'mention mentioned you were mentioned упомянул упомянули упоминание'
    when 'priority_change' then
      'priority change priority changed приоритет изменён urgent high medium low срочный высокий средний низкий без приоритета no priority'
    when 'status_change' then
      'status change status changed статус изменён'
    else coalesce(p_kind, '')
  end;
$$;
-- ---------------------------------------------------------------------------
-- Always-on Mention fan-out
--
-- App passes Mentionee ids + source metadata. RPC:
--   - resolves Task / project from p_task_id
--   - requires actor can_edit_tasks
--   - inserts one row per distinct Mentionee who is current Owner or Member
--   - skips actor and non-members
--   - does not touch task_watchers
-- ---------------------------------------------------------------------------

create or replace function public.create_notifications_for_mentions(
  p_task_id uuid,
  p_mentionee_ids uuid[],
  p_source text,
  p_comment_id uuid default null,
  p_actor_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  v_project_id uuid;
  v_task_key text;
  v_task_title text;
  v_actor_name text;
  v_metadata jsonb;
  v_comment_id uuid;
begin
  if actor is null then
    return;
  end if;

  if p_mentionee_ids is null or cardinality(p_mentionee_ids) = 0 then
    return;
  end if;

  if p_source is null or p_source not in ('description', 'comment') then
    return;
  end if;

  select t.project_id, t.task_key, t.title
    into v_project_id, v_task_key, v_task_title
  from public.tasks as t
  where t.id = p_task_id
  limit 1;

  if v_project_id is null or v_task_key is null or v_task_title is null then
    return;
  end if;

  if public.can_edit_tasks(v_project_id) = false then
    return;
  end if;

  v_comment_id := case
    when p_source = 'comment' then p_comment_id
    else null
  end;

  select coalesce(
    nullif(trim(p_actor_name), ''),
    nullif(trim(p.username), ''),
    actor::text
  )
    into v_actor_name
  from public.profiles as p
  where p.id = actor
  limit 1;

  if v_actor_name is null then
    v_actor_name := coalesce(nullif(trim(p_actor_name), ''), actor::text);
  end if;

  v_metadata := jsonb_build_object(
    'source', p_source,
    'actor', jsonb_build_object(
      'id', actor,
      'name', v_actor_name
    )
  );

  if v_comment_id is not null then
    v_metadata := v_metadata || jsonb_build_object('commentId', v_comment_id);
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
    mentionee_id,
    v_project_id,
    p_task_id,
    'mention',
    v_task_key,
    v_task_title,
    v_metadata
  from (
    select distinct unnest(p_mentionee_ids) as mentionee_id
  ) as mentionees
  where mentionee_id is not null
    and mentionee_id <> actor
    and (
      exists (
        select 1
        from public.projects as p
        where p.id = v_project_id
          and p.owner_id = mentionee_id
      )
      or exists (
        select 1
        from public.project_members as m
        where m.project_id = v_project_id
          and m.user_id = mentionee_id
      )
    );
end;
$$;
-- create_task_notifications must not accept mention via recipient_id path
-- without membership checks — keep mention out of that loop by filtering.
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
revoke all on function public.create_notifications_for_mentions(
  uuid,
  uuid[],
  text,
  uuid,
  text
) from public;
grant execute on function public.create_notifications_for_mentions(
  uuid,
  uuid[],
  text,
  uuid,
  text
) to authenticated;
notify pgrst, 'reload schema';
