-- Watcher kind subtask_change on the Parent Task (ADR 0023 / issue #200).
-- Fan-out stays on create_task_notifications; this widens the curated set.

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
      'mention',
      'subtask_change'
    )
  );

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
    'deadline_change',
    'assignee_change',
    'author_change',
    'subtask_change'
  ]::text[];
$$;

revoke all on function public.notification_watcher_kinds() from public;
grant execute on function public.notification_watcher_kinds() to authenticated;

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
    when 'subtask_change' then
      'subtask change subtask created subtask closed подзадача создана подзадача закрыта подзадача изменена'
    else coalesce(p_kind, '')
  end;
$$;

notify pgrst, 'reload schema';
