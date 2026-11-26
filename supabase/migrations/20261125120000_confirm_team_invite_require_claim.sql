-- confirm_team_invite: tighten the Owner/Admin confirm step (ADR 0003).
--
--   * only a pending invite can be confirmed;
--   * the invite must be claimed, and p_user_id must be the user who claimed it;
--   * confirming never changes an existing member's role — if p_user_id is
--     already on the Team, the call fails instead.
--
-- Everything else (open-kind rejection, manage permission, owner-only admin
-- invites, revoked/expired handling, accepted status + accepted_by) is unchanged.

create or replace function public.confirm_team_invite(
  p_invite_id uuid,
  p_user_id uuid
)
returns public.team_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.team_invites;
  member public.team_members;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  select * into invite
  from public.team_invites as i
  where i.id = p_invite_id
  for update;

  if invite.id is null then
    raise exception 'Invite not found';
  end if;

  if invite.kind = 'open' then
    raise exception 'Open invites cannot be confirmed';
  end if;

  if not public.can_manage_team_members(invite.team_id) then
    raise exception 'Not allowed to confirm invites';
  end if;

  if invite.role = 'admin'::public.project_member_role
     and not public.is_team_owner(invite.team_id) then
    raise exception 'Only the owner can confirm admin invites';
  end if;

  if invite.status = 'revoked' then
    raise exception 'Invite has been revoked';
  end if;

  if invite.expires_at is not null and invite.expires_at < now() then
    update public.team_invites
    set status = 'expired'
    where id = invite.id;
    raise exception 'Invite has expired';
  end if;

  if invite.status <> 'pending' then
    raise exception 'Invite cannot be confirmed';
  end if;

  if p_user_id is null then
    raise exception 'User is required';
  end if;

  if invite.claimed_by is null then
    raise exception 'Invite has not been claimed';
  end if;

  if invite.claimed_by <> p_user_id then
    raise exception 'User has not claimed this invite';
  end if;

  if not exists (
    select 1 from public.profiles as pr where pr.id = p_user_id
  ) then
    raise exception 'User profile not found';
  end if;

  if exists (
    select 1
    from public.teams as t
    where t.id = invite.team_id
      and t.owner_id = p_user_id
  ) then
    raise exception 'Owner is already on this team';
  end if;

  if exists (
    select 1
    from public.team_members as m
    where m.team_id = invite.team_id
      and m.user_id = p_user_id
  ) then
    raise exception 'Already a member of this team';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (invite.team_id, p_user_id, invite.role)
  returning * into member;

  update public.team_invites
  set
    status = 'accepted',
    accepted_by = p_user_id
  where id = invite.id;

  return member;
end;
$$;

revoke all on function public.confirm_team_invite(uuid, uuid) from public;
revoke all on function public.confirm_team_invite(uuid, uuid) from anon;
grant execute on function public.confirm_team_invite(uuid, uuid) to authenticated;
