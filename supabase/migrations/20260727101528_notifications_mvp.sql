-- Notifications MVP: task watchers + user inbox

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.task_watchers (
  task_id uuid not null references public.tasks (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index if not exists task_watchers_user_id_idx
  on public.task_watchers (user_id, created_at desc);
create index if not exists task_watchers_project_id_idx
  on public.task_watchers (project_id);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  kind text not null check (kind in ('status_change', 'assignment')),
  task_key text not null,
  task_title text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_created_at_idx
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_project_recipient_created_at_idx
  on public.notifications (project_id, recipient_id, created_at desc);
create index if not exists notifications_task_id_idx
  on public.notifications (task_id);
-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.task_watchers enable row level security;
alter table public.notifications enable row level security;
create policy "task_watchers_select_can_view_project"
  on public.task_watchers
  for select
  to authenticated
  using (public.can_view_project(project_id));
create policy "task_watchers_insert_self_only"
  on public.task_watchers
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.can_view_project(project_id)
  );
create policy "task_watchers_delete_self_only"
  on public.task_watchers
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and public.can_view_project(project_id)
  );
create policy "notifications_select_recipient_only"
  on public.notifications
  for select
  to authenticated
  using (recipient_id = auth.uid());
create policy "notifications_update_recipient_only"
  on public.notifications
  for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());
-- ---------------------------------------------------------------------------
-- RPC: fan-out writes (status change / assignment)
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
    and (actor is null or w.user_id <> actor);
end;
$$;
create or replace function public.create_notifications_for_assignment_change(
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

  -- self-notify exclusion
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
    'assignment',
    v_task_key,
    v_task_title,
    p_metadata
  );
end;
$$;
-- ---------------------------------------------------------------------------
-- RPC: read state + cleanup (retention)
-- ---------------------------------------------------------------------------

create or replace function public.mark_notifications_read(
  p_notification_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    return;
  end if;

  if p_notification_ids is null or array_length(p_notification_ids, 1) = 0 then
    return;
  end if;

  update public.notifications
  set read_at = now()
  where recipient_id = actor
    and id = any(p_notification_ids)
    and read_at is null;
end;
$$;
create or replace function public.mark_notifications_read_in_scope(
  p_project_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    return;
  end if;

  update public.notifications
  set read_at = now()
  where recipient_id = actor
    and read_at is null
    and (p_project_id is null or project_id = p_project_id);
end;
$$;
create or replace function public.cleanup_notifications_for_user()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    return;
  end if;

  -- Read rows: delete after 30 days.
  -- Unread rows: delete after 90 days (max retention window).
  delete from public.notifications
  where recipient_id = actor
    and (
      (read_at is not null and read_at < now() - interval '30 days')
      or
      (read_at is null and created_at < now() - interval '90 days')
    );
end;
$$;
-- ---------------------------------------------------------------------------
-- Auto-enrollment: Watcher rows on Task create + assignee changes
-- ---------------------------------------------------------------------------

create or replace function public.task_watchers_on_task_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.author_id is not null then
    insert into public.task_watchers (task_id, project_id, user_id)
    values (new.id, new.project_id, new.author_id)
    on conflict do nothing;
  end if;

  if new.assignee_id is not null then
    insert into public.task_watchers (task_id, project_id, user_id)
    values (new.id, new.project_id, new.assignee_id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;
drop trigger if exists task_watchers_on_task_insert on public.tasks;
create trigger task_watchers_on_task_insert
  after insert on public.tasks
  for each row
  execute function public.task_watchers_on_task_insert();
create or replace function public.task_watchers_on_task_assignee_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assignee_id is not null
     and (old.assignee_id is distinct from new.assignee_id) then
    insert into public.task_watchers (task_id, project_id, user_id)
    values (new.id, new.project_id, new.assignee_id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;
drop trigger if exists task_watchers_on_task_assignee_update on public.tasks;
create trigger task_watchers_on_task_assignee_update
  after update of assignee_id on public.tasks
  for each row
  execute function public.task_watchers_on_task_assignee_update();
-- ---------------------------------------------------------------------------
-- Cleanup: delete Watcher rows when a user leaves/removal happens
-- ---------------------------------------------------------------------------

create or replace function public.task_watchers_cleanup_on_project_members_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.task_watchers tw
  where tw.project_id = old.project_id
    and tw.user_id = old.user_id;
  return old;
end;
$$;
drop trigger if exists task_watchers_cleanup_on_project_members_delete on public.project_members;
create trigger task_watchers_cleanup_on_project_members_delete
  after delete on public.project_members
  for each row
  execute function public.task_watchers_cleanup_on_project_members_delete();
-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.create_notifications_for_status_change(uuid, uuid, jsonb) from public;
revoke all on function public.create_notifications_for_assignment_change(uuid, uuid, uuid, jsonb) from public;
revoke all on function public.mark_notifications_read(uuid[]) from public;
revoke all on function public.mark_notifications_read_in_scope(uuid) from public;
revoke all on function public.cleanup_notifications_for_user() from public;
grant execute on function public.create_notifications_for_status_change(uuid, uuid, jsonb) to authenticated;
grant execute on function public.create_notifications_for_assignment_change(uuid, uuid, uuid, jsonb) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.mark_notifications_read_in_scope(uuid) to authenticated;
grant execute on function public.cleanup_notifications_for_user() to authenticated;
grant select, insert, delete on public.task_watchers to authenticated;
grant select, update, delete on public.notifications to authenticated;
-- Realtime badge/sheet freshness for the recipient inbox.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception
  when undefined_object then
    -- Local/dev environments without Realtime publication can skip.
    null;
end;
$$;
notify pgrst, 'reload schema';
