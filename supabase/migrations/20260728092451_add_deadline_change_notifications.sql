-- Add deadline_change notification kind for watcher fan-out.

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
      'author_change'
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
    'author_change'
  ]::text[];
$$;

revoke all on function public.notification_watcher_kinds() from public;
grant execute on function public.notification_watcher_kinds() to authenticated;

notify pgrst, 'reload schema';
