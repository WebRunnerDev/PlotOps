-- #360: a Project is private while at least one linked Repository is.
-- Linking a private Repository locks a public Project; unlinking the last
-- private one unlocks it; Create Project takes per-Repository visibility and
-- falls back to p_is_private for clients that do not send it.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

select set_config('test.owner', 'f5100000-0000-0000-0000-000000000001', true);
select set_config('test.team', 'f6100000-0000-0000-0000-000000000001', true);

set local role postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  (current_setting('test.owner')::uuid, 'authenticated', 'authenticated', 'priv-owner@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, username)
values (current_setting('test.owner')::uuid, 'priv-owner')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values (current_setting('test.team')::uuid, current_setting('test.owner')::uuid, 'Privacy Team');

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

select pg_temp.as_user(current_setting('test.owner')::uuid);

-- Public Project with one public Repository.
select set_config(
  'test.project',
  public.create_project_with_repositories(
    current_setting('test.team')::uuid,
    'Public',
    'public-proj',
    null,
    false,
    '[{"github_repo_id": 8001, "github_full_name": "o/web", "github_html_url": "https://github.com/o/web", "github_default_branch": "main", "is_private": false}]'::jsonb
  )::text,
  true
);

select is(
  (select is_private from public.projects where id = current_setting('test.project')::uuid),
  false,
  'a Project from a public Repository is public'
);

-- Link a private Repository → the Project locks.
insert into public.project_repositories (project_id, team_id, github_repo_id, github_full_name, github_html_url, is_private)
values (current_setting('test.project')::uuid, current_setting('test.team')::uuid, 8002, 'o/infra', 'https://github.com/o/infra', true);

select is(
  (select is_private from public.projects where id = current_setting('test.project')::uuid),
  true,
  'linking a private Repository makes a public Project private'
);

-- A second private Repository; unlinking one keeps the lock.
insert into public.project_repositories (project_id, team_id, github_repo_id, github_full_name, github_html_url, is_private)
values (current_setting('test.project')::uuid, current_setting('test.team')::uuid, 8003, 'o/secrets', 'https://github.com/o/secrets', true);

delete from public.project_repositories where github_repo_id = 8002 and project_id = current_setting('test.project')::uuid;

select is(
  (select is_private from public.projects where id = current_setting('test.project')::uuid),
  true,
  'the Project stays private while another private Repository is linked'
);

delete from public.project_repositories where github_repo_id = 8003 and project_id = current_setting('test.project')::uuid;

select is(
  (select is_private from public.projects where id = current_setting('test.project')::uuid),
  false,
  'unlinking the last private Repository makes the Project public again'
);

-- Unlinking every Repository leaves a public, name-only Project.
delete from public.project_repositories where project_id = current_setting('test.project')::uuid;

select is(
  (select is_private from public.projects where id = current_setting('test.project')::uuid),
  false,
  'a Project with no Repositories is public'
);

-- Create Project from a public + a private Repository.
select set_config(
  'test.mixed',
  public.create_project_with_repositories(
    current_setting('test.team')::uuid,
    'Mixed',
    'mixed',
    null,
    true,
    '[{"github_repo_id": 8011, "github_full_name": "o/pub", "github_html_url": "", "github_default_branch": "main", "is_private": false},
      {"github_repo_id": 8012, "github_full_name": "o/priv", "github_html_url": "", "github_default_branch": "main", "is_private": true}]'::jsonb
  )::text,
  true
);

select results_eq(
  $$select github_full_name, is_private from public.project_repositories
    where project_id = current_setting('test.mixed')::uuid
    order by github_repo_id$$,
  $$values ('o/pub'::text, false), ('o/priv'::text, true)$$,
  'Create Project stores each Repository''s visibility'
);

select is(
  (select is_private from public.projects where id = current_setting('test.mixed')::uuid),
  true,
  'a Project with any private Repository is private'
);

-- An older client sends no per-Repository is_private: fall back to p_is_private.
select set_config(
  'test.legacy',
  public.create_project_with_repositories(
    current_setting('test.team')::uuid,
    'Legacy',
    'legacy',
    null,
    true,
    '[{"github_repo_id": 8021, "github_full_name": "o/legacy", "github_html_url": "", "github_default_branch": "main"}]'::jsonb
  )::text,
  true
);

select is(
  (select is_private from public.project_repositories where github_repo_id = 8021 and team_id = current_setting('test.team')::uuid),
  true,
  'a Repository without is_private takes p_is_private'
);

select is(
  (select is_private from public.projects where id = current_setting('test.legacy')::uuid),
  true,
  'the legacy-created Project keeps the visibility it asked for'
);

select * from finish();
rollback;
