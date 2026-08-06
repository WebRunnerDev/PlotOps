-- Prevent later callers from overwriting team_invites.claimed_by.
-- First claimant wins; re-claim by the same user is idempotent.

create or replace function public.claim_team_invite(p_token text)
returns public.team_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.team_invites;
  caller uuid := (select auth.uid());
  caller_email text;
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;

  select * into invite
  from public.team_invites as i
  where i.token = p_token
  for update;

  if invite.id is null then
    raise exception 'Invite not found';
  end if;

  if invite.status <> 'pending' then
    raise exception 'Invite is not pending';
  end if;

  if invite.expires_at is not null and invite.expires_at < now() then
    update public.team_invites
    set status = 'expired'
    where id = invite.id;
    raise exception 'Invite has expired';
  end if;

  select u.email into caller_email
  from auth.users as u
  where u.id = caller;

  if caller_email is not null
     and lower(caller_email) = lower(invite.email) then
    raise exception 'Email matches — accept the invite instead';
  end if;

  if exists (
    select 1
    from public.teams as t
    where t.id = invite.team_id
      and t.owner_id = caller
  ) then
    raise exception 'Owner is already on this team';
  end if;

  if exists (
    select 1
    from public.team_members as m
    where m.team_id = invite.team_id
      and m.user_id = caller
  ) then
    raise exception 'Already a member of this team';
  end if;

  if invite.claimed_by is not null then
    if invite.claimed_by <> caller then
      raise exception 'Invite already claimed by another user';
    end if;
    return invite;
  end if;

  update public.team_invites
  set claimed_by = caller
  where id = invite.id
  returning * into invite;

  return invite;
end;
$$;
