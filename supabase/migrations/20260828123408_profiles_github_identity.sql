-- Canonical GitHub identity on profiles (ADR 0026, #224).
-- Unique on github_id (stable); github_login is not unique (renames allowed).

alter table public.profiles
  add column if not exists github_login text,
  add column if not exists github_id bigint;

create unique index if not exists profiles_github_id_unique
  on public.profiles (github_id)
  where github_id is not null;

-- Backfill from linked GitHub auth identities (local + remote after deploy).
update public.profiles as p
set
  github_login = coalesce(
    p.github_login,
    nullif(trim(i.identity_data ->> 'user_name'), ''),
    nullif(trim(i.identity_data ->> 'preferred_username'), ''),
    nullif(trim(i.identity_data ->> 'login'), '')
  ),
  github_id = coalesce(
    p.github_id,
    case
      when i.provider_id ~ '^\d+$' then i.provider_id::bigint
      when (i.identity_data ->> 'sub') ~ '^\d+$' then (i.identity_data ->> 'sub')::bigint
      else null
    end
  )
from auth.identities as i
where i.user_id = p.id
  and i.provider = 'github';

notify pgrst, 'reload schema';
