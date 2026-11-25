-- BUG-163: a client links a Repository only after GitHub has confirmed the
-- caller's access to it (`verify-github-repositories`). Without that, an Admin
-- of any Team could link another Team's repository by id and receive its
-- branches and PRs through the webhook and backfill.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

select set_config('test.admin', 'f8000000-0000-0000-0000-000000000001', true);
select set_config('test.other', 'f8000000-0000-0000-0000-000000000002', true);
select set_config('test.team', 'f9000000-0000-0000-0000-000000000001', true);

set local role postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  (current_setting('test.admin')::uuid, 'authenticated', 'authenticated', 'verify-admin@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.other')::uuid, 'authenticated', 'authenticated', 'verify-other@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, username)
values
  (current_setting('test.admin')::uuid, 'verify-admin'),
  (current_setting('test.other')::uuid, 'verify-other')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values (current_setting('test.team')::uuid, current_setting('test.admin')::uuid, 'Verify Team');

-- 9001: verified by the admin just now. 9002: verified by someone else only.
-- 9003: the admin's verification is too old.
insert into public.github_repository_verifications (
  user_id, github_repo_id, github_full_name, github_html_url, github_default_branch, is_private, verified_at
)
values
  (current_setting('test.admin')::uuid, 9001, 'acme/real', 'https://github.com/acme/real', 'trunk', true, now()),
  (current_setting('test.other')::uuid, 9002, 'acme/theirs', 'https://github.com/acme/theirs', 'main', false, now()),
  (current_setting('test.admin')::uuid, 9003, 'acme/stale', 'https://github.com/acme/stale', 'main', false, now() - interval '16 minutes');

create or replace function pg_temp.as_user(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

select pg_temp.as_user(current_setting('test.admin')::uuid);

select set_config(
  'test.project',
  public.create_project_with_repositories(
    current_setting('test.team')::uuid, 'Verify', 'verify', null, false, '[]'::jsonb
  )::text,
  true
);

-- ---------------------------------------------------------------------------
-- Unverified links are refused
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.project_repositories (project_id, team_id, github_repo_id, github_full_name, github_html_url)
    values (current_setting('test.project')::uuid, current_setting('test.team')::uuid, 9999, 'victim/secret', 'https://github.com/victim/secret')$$,
  '42501',
  null,
  'a Repository with no verification cannot be linked'
);

select throws_ok(
  $$insert into public.project_repositories (project_id, team_id, github_repo_id, github_full_name, github_html_url)
    values (current_setting('test.project')::uuid, current_setting('test.team')::uuid, 9002, 'acme/theirs', 'https://github.com/acme/theirs')$$,
  '42501',
  null,
  'another user''s verification does not count'
);

select throws_ok(
  $$insert into public.project_repositories (project_id, team_id, github_repo_id, github_full_name, github_html_url)
    values (current_setting('test.project')::uuid, current_setting('test.team')::uuid, 9003, 'acme/stale', 'https://github.com/acme/stale')$$,
  '42501',
  null,
  'a verification older than 15 minutes does not count'
);

select throws_ok(
  $$select public.create_project_with_repositories(
      current_setting('test.team')::uuid, 'Spoof', 'spoof', null, false,
      '[{"github_repo_id": 9999, "github_full_name": "victim/secret", "github_html_url": "https://github.com/victim/secret", "github_default_branch": "main"}]'::jsonb)$$,
  '42501',
  null,
  'Create Project refuses an unverified Repository'
);

select is(
  (select count(*)::integer from public.projects where team_id = current_setting('test.team')::uuid and slug = 'spoof'),
  0,
  'the refused create leaves no Project behind'
);

-- ---------------------------------------------------------------------------
-- A verified link stores what GitHub said, not what the client sent
-- ---------------------------------------------------------------------------

select lives_ok(
  $$insert into public.project_repositories (project_id, team_id, github_repo_id, github_full_name, github_html_url, github_default_branch, is_private)
    values (current_setting('test.project')::uuid, current_setting('test.team')::uuid, 9001, 'victim/secret', 'https://evil.example/x', 'main', false)$$,
  'a verified Repository can be linked'
);

select results_eq(
  $$select github_full_name, github_html_url, github_default_branch, is_private
    from public.project_repositories where github_repo_id = 9001$$,
  $$values ('acme/real'::text, 'https://github.com/acme/real'::text, 'trunk'::text, true)$$,
  'name, URL, default branch and visibility come from the verification'
);

select is(
  (select is_private from public.projects where id = current_setting('test.project')::uuid),
  true,
  'the Project takes the verified visibility'
);

-- ---------------------------------------------------------------------------
-- A linked row cannot be repointed, and clients cannot touch verifications
-- ---------------------------------------------------------------------------

select is(
  has_table_privilege('authenticated', 'public.project_repositories', 'UPDATE'),
  false,
  'clients hold no UPDATE grant on project_repositories'
);

select throws_ok(
  $$update public.project_repositories set github_repo_id = 9999 where github_repo_id = 9001$$,
  '42501',
  null,
  'a linked Repository cannot be pointed at another GitHub repository'
);

select throws_ok(
  $$select count(*) from public.github_repository_verifications$$,
  '42501',
  null,
  'clients cannot read verifications'
);

select throws_ok(
  $$insert into public.github_repository_verifications (user_id, github_repo_id, github_full_name, github_html_url, github_default_branch, is_private)
    values (auth.uid(), 9999, 'victim/secret', 'https://github.com/victim/secret', 'main', false)$$,
  '42501',
  null,
  'clients cannot write their own verification'
);

select is(
  (select count(*)::integer from public.verified_github_repository(9002)),
  0,
  'verified_github_repository shows only the caller''s own verifications'
);

-- ---------------------------------------------------------------------------
-- Trusted writers (service role) are not subject to the check
-- ---------------------------------------------------------------------------

set local role service_role;

select lives_ok(
  $$insert into public.project_repositories (project_id, team_id, github_repo_id, github_full_name, github_html_url)
    values (current_setting('test.project')::uuid, current_setting('test.team')::uuid, 9004, 'acme/svc', 'https://github.com/acme/svc')$$,
  'the service role links without a verification'
);

select * from finish();
rollback;
