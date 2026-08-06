-- Harden invite preview: authenticated only; do not return invitee email or claimed_by.

drop function if exists public.get_team_invite_by_token(text);

create or replace function public.get_team_invite_by_token(p_token text)
returns table (
  id uuid,
  team_id uuid,
  team_name text,
  role public.project_member_role,
  status public.project_invite_status,
  expires_at timestamptz,
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
    (
      caller_email is not null
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
