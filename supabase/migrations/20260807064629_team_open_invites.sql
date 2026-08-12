-- Open team invites: kind email|open, nullable email, multi-use redeem_count.

-- ---------------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------------

alter table public.team_invites
  add column if not exists kind text not null default 'email',
  add column if not exists redeem_count integer not null default 0;

alter table public.team_invites
  drop constraint if exists team_invites_email_nonempty;

alter table public.team_invites
  alter column email drop not null;

alter table public.team_invites
  drop constraint if exists team_invites_kind_check;

alter table public.team_invites
  add constraint team_invites_kind_check
  check (kind in ('email', 'open'));

alter table public.team_invites
  drop constraint if exists team_invites_kind_email_consistency;

alter table public.team_invites
  add constraint team_invites_kind_email_consistency
  check (
    (kind = 'email' and length(trim(email)) > 0)
    or (kind = 'open' and email is null)
  );

drop index if exists public.team_invites_pending_email_unique;

create unique index team_invites_pending_email_unique
  on public.team_invites (team_id, lower(email))
  where status = 'pending' and kind = 'email';

-- ---------------------------------------------------------------------------
-- 2. Preview RPC: include kind
-- ---------------------------------------------------------------------------

drop function if exists public.get_team_invite_by_token(text);

create or replace function public.get_team_invite_by_token(p_token text)
returns table (
  id uuid,
  team_id uuid,
  team_name text,
  role public.project_member_role,
  status public.project_invite_status,
  expires_at timestamptz,
  kind text,
  email_matches boolean,
  is_claimed boolean,
  claimed_by_me boolean
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  caller uuid := (select auth.uid());
  caller_email text;
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;

  if p_token is null or length(trim(p_token)) = 0 then
    return;
  end if;

  select u.email into caller_email
  from auth.users as u
  where u.id = caller;

  return query
  select
    i.id,
    i.team_id,
    t.name,
    i.role,
    case
      when i.status = 'pending'
        and i.expires_at is not null
        and i.expires_at < now()
      then 'expired'::public.project_invite_status
      else i.status
    end,
    i.expires_at,
    i.kind,
    (
      i.kind = 'email'
      and caller_email is not null
      and i.email is not null
      and lower(caller_email) = lower(i.email)
    ) as email_matches,
    (i.claimed_by is not null) as is_claimed,
    (i.claimed_by is not null and i.claimed_by = caller) as claimed_by_me
  from public.team_invites as i
  join public.teams as t on t.id = i.team_id
  where i.token = p_token
  limit 1;
end;
$$;

revoke all on function public.get_team_invite_by_token(text) from public;
revoke all on function public.get_team_invite_by_token(text) from anon;
grant execute on function public.get_team_invite_by_token(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Accept: branch open vs email
-- ---------------------------------------------------------------------------

create or replace function public.accept_team_invite(p_token text)
returns public.team_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.team_invites;
  caller uuid := (select auth.uid());
  caller_email text;
  member public.team_members;
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

  if invite.status = 'revoked' then
    raise exception 'Invite has been revoked';
  end if;

  if invite.status = 'accepted' then
    raise exception 'Invite already accepted';
  end if;

  if invite.expires_at is not null and invite.expires_at < now() then
    update public.team_invites
    set status = 'expired'
    where id = invite.id;
    raise exception 'Invite has expired';
  end if;

  if invite.status <> 'pending' then
    raise exception 'Invite is not pending';
  end if;

  if invite.kind = 'open' then
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

    insert into public.team_members (team_id, user_id, role)
    values (invite.team_id, caller, invite.role)
    returning * into member;

    update public.team_invites
    set redeem_count = redeem_count + 1
    where id = invite.id;

    return member;
  end if;

  -- email kind (ADR 0003)
  select u.email into caller_email
  from auth.users as u
  where u.id = caller;

  if caller_email is null
     or invite.email is null
     or lower(caller_email) <> lower(invite.email) then
    raise exception 'Email does not match invite. Ask an owner or admin to confirm.';
  end if;

  if public.is_team_owner(invite.team_id) then
    raise exception 'Owner is already on this team';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (invite.team_id, caller, invite.role)
  on conflict (team_id, user_id) do update
    set role = excluded.role
  returning * into member;

  update public.team_invites
  set
    status = 'accepted',
    accepted_by = caller
  where id = invite.id;

  return member;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Claim / confirm: reject open kind
-- ---------------------------------------------------------------------------

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

  if invite.kind = 'open' then
    raise exception 'Open invites cannot be claimed';
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
     and invite.email is not null
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

  if invite.status not in ('pending', 'accepted') then
    raise exception 'Invite cannot be confirmed';
  end if;

  if p_user_id is null then
    raise exception 'User is required';
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

  insert into public.team_members (team_id, user_id, role)
  values (invite.team_id, p_user_id, invite.role)
  on conflict (team_id, user_id) do update
    set role = excluded.role
  returning * into member;

  update public.team_invites
  set
    status = 'accepted',
    accepted_by = p_user_id
  where id = invite.id;

  return member;
end;
$$;
