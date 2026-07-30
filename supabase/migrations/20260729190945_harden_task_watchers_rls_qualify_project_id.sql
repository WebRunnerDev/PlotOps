-- Qualify task_watchers columns inside EXISTS so Postgres does not bind
-- unqualified `project_id` to tasks.project_id (which made the check a tautology).

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
      where t.id = task_watchers.task_id
        and t.project_id = task_watchers.project_id
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
      where t.id = task_watchers.task_id
        and t.project_id = task_watchers.project_id
    )
  );

notify pgrst, 'reload schema';
