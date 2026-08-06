-- Fix teams INSERT…RETURNING (PostgREST Prefer: return=representation / .select()).
-- INSERT WITH CHECK (owner_id = auth.uid()) already succeeds, but SELECT policy
-- used only is_team_member(id) → is_team_owner(), which re-queries public.teams
-- and does not see the in-flight row during RETURNING. Evaluate owner_id on the
-- new row directly so createProject (and create-Team) can return the new id.

drop policy if exists "teams_select_member" on public.teams;
create policy "teams_select_member"
  on public.teams
  for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or public.is_team_member(id)
  );
