-- Extend invite preview with claimed_by so claimants can see waiting state.

create or replace function public.get_project_invite_by_token(p_token text)
returns table (
  id uuid,
  project_id uuid,
  project_name text,
  email text,
  role public.project_member_role,
  status public.project_invite_status,
  expires_at timestamptz,
  claimed_by uuid
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return;
  end if;

  return query
  select
    i.id,
    i.project_id,
    p.name,
    i.email,
    i.role,
    case
      when i.status = 'pending'
        and i.expires_at is not null
        and i.expires_at < now()
      then 'expired'::public.project_invite_status
      else i.status
    end,
    i.expires_at,
    i.claimed_by
  from public.project_invites as i
  join public.projects as p on p.id = i.project_id
  where i.token = p_token
  limit 1;
end;
$$;
