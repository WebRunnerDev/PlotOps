-- Comment Watcher fan-out: honor per-event exclude_recipient_ids so Mentionees
-- who get always-on `mention` are omitted from Watcher `comment` (issue #245).

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
  event_exclude_ids uuid[];
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

    -- Per-event Mentionee (or other) exclusions for Mention/`comment` dedupe.
    select coalesce(
      array_agg(distinct nullif(x.exclude_id, '')::uuid)
        filter (where nullif(x.exclude_id, '') is not null),
      '{}'::uuid[]
    )
      into event_exclude_ids
    from jsonb_array_elements_text(
      coalesce(ev -> 'exclude_recipient_ids', '[]'::jsonb)
    ) as x(exclude_id);

    exclude_ids := exclude_ids || coalesce(event_exclude_ids, '{}'::uuid[]);

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
