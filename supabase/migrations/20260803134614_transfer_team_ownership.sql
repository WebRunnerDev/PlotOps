-- Transfer Team ownership (Owner only): move teams.owner_id, demote former
-- Owner to Admin Member, drop new Owner's team_members row.

create or replace function public.transfer_team_ownership(
  p_team_id uuid,
  p_new_owner_id uuid
)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  team public.teams;
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;

  select * into team
  from public.teams as t
  where t.id = p_team_id
  for update;

  if team.id is null then
    raise exception 'Team not found';
  end if;

  if team.owner_id is distinct from caller then
    raise exception 'Only the owner can transfer ownership';
  end if;

  if p_new_owner_id is null then
    raise exception 'New owner is required';
  end if;

  if p_new_owner_id = caller then
    raise exception 'Already the owner';
  end if;

  if not exists (
    select 1
    from public.team_members as m
    where m.team_id = p_team_id
      and m.user_id = p_new_owner_id
  ) then
    raise exception 'New owner must be a current team member';
  end if;

  if not exists (
    select 1 from public.profiles as pr where pr.id = p_new_owner_id
  ) then
    raise exception 'User profile not found';
  end if;

  delete from public.team_members
  where team_id = p_team_id
    and user_id = p_new_owner_id;

  insert into public.team_members (team_id, user_id, role)
  values (p_team_id, caller, 'admin'::public.project_member_role)
  on conflict (team_id, user_id) do update
    set role = excluded.role;

  update public.teams
  set owner_id = p_new_owner_id
  where id = p_team_id
  returning * into team;

  return team;
end;
$$;

revoke all on function public.transfer_team_ownership(uuid, uuid) from public;
grant execute on function public.transfer_team_ownership(uuid, uuid) to authenticated;
