-- Wave 3: Auth hooks (Postgres functions). Enable in Dashboard → Auth → Hooks after deploy.
-- Local: supabase/config.toml [auth.hook.*] mirrors remote. See docs/security/wave-3-runbook.md.

-- ---------------------------------------------------------------------------
-- before_user_created — reject anonymous signups; require email for email provider
-- ---------------------------------------------------------------------------

create or replace function public.before_user_created_hook(hook_event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  is_anonymous boolean;
  email text;
  provider text;
begin
  is_anonymous := coalesce((hook_event->'user'->>'is_anonymous')::boolean, false);

  if is_anonymous then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Anonymous sign-ups are not allowed.'
      )
    );
  end if;

  provider := hook_event->'user'->'app_metadata'->>'provider';
  email := nullif(trim(coalesce(hook_event->'user'->>'email', '')), '');

  if provider = 'email' and email is null then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 400,
        'message', 'A valid email address is required to sign up.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

-- ---------------------------------------------------------------------------
-- custom_access_token — mirror profiles.username into JWT user_metadata (display only)
-- ---------------------------------------------------------------------------

create or replace function public.custom_access_token_hook(hook_event jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  claims jsonb;
  profile_username text;
  user_id uuid;
begin
  claims := coalesce(hook_event->'claims', '{}'::jsonb);
  user_id := coalesce(
    nullif(trim(hook_event->>'user_id'), '')::uuid,
    nullif(trim(claims->>'sub'), '')::uuid
  );

  if user_id is null then
    return jsonb_build_object('claims', claims);
  end if;

  select p.username
    into profile_username
  from public.profiles as p
  where p.id = user_id;

  if profile_username is not null and btrim(profile_username) <> '' then
    claims := claims || jsonb_build_object(
      'user_metadata',
      coalesce(claims->'user_metadata', '{}'::jsonb)
        || jsonb_build_object('username', profile_username)
    );
  end if;

  return jsonb_build_object('claims', claims);
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions — hooks callable only by GoTrue (supabase_auth_admin)
-- ---------------------------------------------------------------------------

grant usage on schema public to supabase_auth_admin;

grant execute on function public.before_user_created_hook(jsonb) to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

revoke all on function public.before_user_created_hook(jsonb) from public;
revoke all on function public.before_user_created_hook(jsonb) from anon;
revoke all on function public.before_user_created_hook(jsonb) from authenticated;

revoke all on function public.custom_access_token_hook(jsonb) from public;
revoke all on function public.custom_access_token_hook(jsonb) from anon;
revoke all on function public.custom_access_token_hook(jsonb) from authenticated;

grant select on table public.profiles to supabase_auth_admin;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_select_auth_admin_token_hook'
  ) then
    create policy "profiles_select_auth_admin_token_hook"
      on public.profiles
      for select
      to supabase_auth_admin
      using (true);
  end if;
end;
$$;
