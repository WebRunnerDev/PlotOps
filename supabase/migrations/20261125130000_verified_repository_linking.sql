-- BUG-163: a Repository is linked only after GitHub has confirmed that the
-- person linking it can reach it.
--
-- Before this, any Admin could insert a `project_repositories` row with any
-- `github_repo_id` / `github_full_name`. The webhook and `github-backfill`
-- then copied that repository's branches and PRs into the Admin's Tasks: a
-- leak across Teams.
--
--   github_repository_verifications  written only by the
--     `verify-github-repositories` Edge Function, which asks GitHub with the
--     caller's own token (`GET /repos/{full_name}`).
--   project_repositories INSERT  from a signed-in client needs the caller's
--     verification from the last 15 minutes. The name, URL, default branch and
--     visibility are taken from it, not from the client.
--   project_repositories UPDATE  no longer granted to clients (none uses it),
--     so a verified row cannot be pointed at another repository afterwards.

-- ---------------------------------------------------------------------------
-- 1. Verifications
-- ---------------------------------------------------------------------------

create table public.github_repository_verifications (
  user_id uuid not null references auth.users (id) on delete cascade,
  github_repo_id bigint not null,
  -- As GitHub reported them at verification time.
  github_full_name text not null,
  github_html_url text not null,
  github_default_branch text not null,
  is_private boolean not null,
  verified_at timestamptz not null default now(),
  primary key (user_id, github_repo_id),
  constraint github_repository_verifications_full_name_not_blank
    check (btrim(github_full_name) <> ''),
  constraint github_repository_verifications_default_branch_not_blank
    check (btrim(github_default_branch) <> '')
);

alter table public.github_repository_verifications enable row level security;

revoke all on public.github_repository_verifications from public, anon, authenticated;
grant select, insert, update, delete on public.github_repository_verifications to service_role;

-- The caller's verification of one repository, if it is recent enough. Security
-- definer: clients hold no grant on the table; they only ever see their own row.
create or replace function public.verified_github_repository(p_github_repo_id bigint)
returns table (
  github_full_name text,
  github_html_url text,
  github_default_branch text,
  is_private boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.github_full_name, v.github_html_url, v.github_default_branch, v.is_private
  from public.github_repository_verifications as v
  where v.user_id = (select auth.uid())
    and v.github_repo_id = p_github_repo_id
    and v.verified_at > now() - interval '15 minutes'
$$;

revoke all on function public.verified_github_repository(bigint) from public, anon;
grant execute on function public.verified_github_repository(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Linking requires a verification
-- ---------------------------------------------------------------------------

-- Security invoker on purpose: `current_user` is the caller's role, so the
-- check applies to signed-in clients (direct insert or
-- `create_project_with_repositories`) and not to migrations or the service
-- role. Runs after `project_repositories_before_insert` (trigger names sort),
-- so the default branch below wins over the client's.
create or replace function public.project_repositories_require_verification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  select v.github_full_name, v.github_html_url, v.github_default_branch, v.is_private
  into new.github_full_name, new.github_html_url, new.github_default_branch, new.is_private
  from public.verified_github_repository(new.github_repo_id) as v;

  if not found then
    raise exception 'GitHub access to repository % is not verified', new.github_repo_id
      using errcode = '42501', hint = 'github_repository_unverified';
  end if;

  return new;
end;
$$;

revoke all on function public.project_repositories_require_verification() from public;

create trigger project_repositories_require_verification
  before insert on public.project_repositories
  for each row
  execute function public.project_repositories_require_verification();

-- ---------------------------------------------------------------------------
-- 3. No client UPDATE
-- ---------------------------------------------------------------------------

drop policy project_repositories_update_admins on public.project_repositories;
revoke update on public.project_repositories from authenticated;
