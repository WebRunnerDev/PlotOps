-- Allow Owner/Admin/Manager/Contributor to manage other Members' Watches
-- (ADR 0029). Viewer remains self-only. Targets must be Project participants
-- (Team Owner or Member who can view the Task).
--
-- Uses a SECURITY DEFINER helper so RLS does not require client EXECUTE on
-- is_project_participant (revoked from authenticated).

create or replace function public.can_manage_task_watcher(
  p_project_id uuid,
  p_target_user_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    p_target_user_id is not null
    and (
      (
        p_target_user_id = (select auth.uid())
        and public.can_view_project(p_project_id)
      )
      or (
        public.can_edit_tasks(p_project_id)
        and public.is_project_participant(p_project_id, p_target_user_id)
      )
    );
$$;

revoke all on function public.can_manage_task_watcher(uuid, uuid) from public;
revoke all on function public.can_manage_task_watcher(uuid, uuid) from anon;
grant execute on function public.can_manage_task_watcher(uuid, uuid) to authenticated;
grant execute on function public.can_manage_task_watcher(uuid, uuid) to service_role;

drop policy if exists "task_watchers_insert_self_only" on public.task_watchers;
drop policy if exists "task_watchers_insert" on public.task_watchers;
create policy "task_watchers_insert"
  on public.task_watchers
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.tasks as t
      where t.id = task_watchers.task_id
        and t.project_id = task_watchers.project_id
    )
    and public.can_manage_task_watcher(project_id, user_id)
  );

drop policy if exists "task_watchers_delete_self_only" on public.task_watchers;
drop policy if exists "task_watchers_delete" on public.task_watchers;
create policy "task_watchers_delete"
  on public.task_watchers
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.tasks as t
      where t.id = task_watchers.task_id
        and t.project_id = task_watchers.project_id
    )
    and public.can_manage_task_watcher(project_id, user_id)
  );

notify pgrst, 'reload schema';
