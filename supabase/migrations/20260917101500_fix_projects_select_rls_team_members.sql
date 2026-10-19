-- Team admins could not add a project to a Team.
--
-- INSERT ... RETURNING re-evaluates the SELECT policy on the new row, and
-- `can_view_project(id)` -> `is_project_member(id)` -> `project_team_id(id)`
-- re-queries public.projects, which cannot see the row mid-INSERT. Team owners
-- still passed because the policy also checked teams.owner_id against the NEW
-- row's team_id column; everyone else failed with 42501 and the insert rolled
-- back, so the repo list click looked like a no-op.
--
-- This is the same class of bug 20260730072835 fixed via `auth.uid() = owner_id`;
-- that shortcut was lost when 20260803130716 rewrote the policy after
-- projects.owner_id was dropped. Evaluate Team membership on the NEW row's
-- team_id column directly instead of looking the project row back up.
--
-- Coverage is unchanged for existing rows: is_team_member() already includes
-- the Team owner, and project_team_id(id) is projects.team_id by definition.

drop policy if exists "projects_select_member" on public.projects;

create policy "projects_select_member"
  on public.projects
  for select
  to authenticated
  using (public.is_team_member(team_id));
