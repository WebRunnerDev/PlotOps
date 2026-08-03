-- Always-on assignee_change to the previous Assignee on reassign (ADR 0011
-- expansion). Watcher fan-out still excludes always-on recipients (assignment
-- + previous-assignee assignee_change) so each person gets one row.

create or replace function public.notification_always_on_kinds()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'assignment',
    'assignee_change',
    'author_change',
    'mention'
  ]::text[];
$$;

revoke all on function public.notification_always_on_kinds() from public;
grant execute on function public.notification_always_on_kinds() to authenticated;

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
      'assignee change assignee changed assignee set to you are no longer the assignee исполнитель изменён исполнитель вас сняли с роли исполнителя'
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
  always_on_assignee_change_recipients uuid[] := '{}'::uuid[];
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
    elsif v_kind = 'assignee_change' then
      always_on_assignee_change_recipients :=
        array_append(always_on_assignee_change_recipients, v_recipient);
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
        when v_kind = 'assignee_change' then
          always_on_assignment_recipients || always_on_assignee_change_recipients
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
