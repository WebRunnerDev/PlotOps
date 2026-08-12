-- addTaskWatch uses PostgREST upsert (INSERT ... ON CONFLICT DO UPDATE).
-- Postgres requires UPDATE privilege for that statement even when no row conflicts.
-- Also add an UPDATE RLS policy so conflict retries (already watching) succeed.

grant update on public.task_watchers to authenticated;

drop policy if exists "task_watchers_update_self_only" on public.task_watchers;
create policy "task_watchers_update_self_only"
  on public.task_watchers
  for update
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
  )
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

notify pgrst, 'reload schema';
