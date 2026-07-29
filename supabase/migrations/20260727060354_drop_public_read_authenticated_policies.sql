-- Remove accidentally applied dashboard policies that grant SELECT on entire
-- tables to any authenticated role. Postgres OR's permissive policies, so these
-- bypassed member-scoped RLS (projects_select_member, tasks_select_member,
-- profiles_select_own_or_shared) and leaked other users' projects/tasks/profiles.

drop policy if exists "Allow public read for authenticated" on public.projects;
drop policy if exists "Allow public read for authenticated" on public.tasks;
drop policy if exists "Allow public read for authenticated" on public.profiles;
