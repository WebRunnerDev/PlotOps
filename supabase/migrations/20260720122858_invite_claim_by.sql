-- Allow invitees with mismatched email to claim an invite for Owner/Admin confirm.

alter table public.project_invites
  add column if not exists claimed_by uuid references public.profiles (id) on delete set null;

create or replace function public.claim_project_invite(p_token text)
returns public.project_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.project_invites;
  caller uuid := (select auth.uid());
  caller_email text;
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;

  select * into invite
  from public.project_invites as i
  where i.token = p_token
  for update;

  if invite.id is null then
    raise exception 'Invite not found';
  end if;

  if invite.status <> 'pending' then
    raise exception 'Invite is not pending';
  end if;

  if invite.expires_at is not null and invite.expires_at < now() then
    update public.project_invites
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
    from public.projects as p
    where p.id = invite.project_id
      and p.owner_id = caller
  ) then
    raise exception 'Owner is already on this project';
  end if;

  if exists (
    select 1
    from public.project_members as m
    where m.project_id = invite.project_id
      and m.user_id = caller
  ) then
    raise exception 'Already a member of this project';
  end if;

  update public.project_invites
  set claimed_by = caller
  where id = invite.id
  returning * into invite;

  return invite;
end;
$$;

revoke all on function public.claim_project_invite(text) from public;
grant execute on function public.claim_project_invite(text) to authenticated;

notify pgrst, 'reload schema';
