-- INSERT ... RETURNING evaluates SELECT policies on the new row.
-- projects_select_member used can_view_project → is_project_owner (STABLE),
-- which re-queries public.projects and cannot see the row mid-INSERT.
-- Client createProject uses .insert().select(), so creation failed with 42501.
-- Evaluate owner_id on the NEW row directly so RETURNING works for owners.

drop policy if exists "projects_select_member" on public.projects;

create policy "projects_select_member"
  on public.projects
  for select
  to authenticated
  using (
    (select auth.uid()) = owner_id
    or public.can_view_project(id)
  );
