-- Team capability helpers + Project access via team_id (seam 1–2)
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

-- Fixed UUIDs for fixtures
select set_config('test.owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('test.admin', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select set_config('test.manager', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
select set_config('test.contributor', 'dddddddd-dddd-dddd-dddd-dddddddddddd', true);
select set_config('test.viewer', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true);
select set_config('test.outsider', 'ffffffff-ffff-ffff-ffff-ffffffffffff', true);

-- Bypass RLS for fixture setup
set local role postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  (current_setting('test.owner')::uuid, 'authenticated', 'authenticated', 'owner@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.admin')::uuid, 'authenticated', 'authenticated', 'admin@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.manager')::uuid, 'authenticated', 'authenticated', 'manager@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.contributor')::uuid, 'authenticated', 'authenticated', 'contributor@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.viewer')::uuid, 'authenticated', 'authenticated', 'viewer@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.outsider')::uuid, 'authenticated', 'authenticated', 'outsider@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, username)
values
  (current_setting('test.owner')::uuid, 'owner'),
  (current_setting('test.admin')::uuid, 'admin'),
  (current_setting('test.manager')::uuid, 'manager'),
  (current_setting('test.contributor')::uuid, 'contributor'),
  (current_setting('test.viewer')::uuid, 'viewer'),
  (current_setting('test.outsider')::uuid, 'outsider')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values ('11111111-1111-1111-1111-111111111111', current_setting('test.owner')::uuid, 'Acme')
on conflict (id) do nothing;

insert into public.team_members (team_id, user_id, role)
values
  ('11111111-1111-1111-1111-111111111111', current_setting('test.admin')::uuid, 'admin'),
  ('11111111-1111-1111-1111-111111111111', current_setting('test.manager')::uuid, 'manager'),
  ('11111111-1111-1111-1111-111111111111', current_setting('test.contributor')::uuid, 'contributor'),
  ('11111111-1111-1111-1111-111111111111', current_setting('test.viewer')::uuid, 'viewer')
on conflict do nothing;

insert into public.projects (id, team_id, name, slug, github_repo_id)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Repo A',
  'repo-a',
  1001
)
on conflict (id) do nothing;

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

-- Owner capabilities
select pg_temp.as_user(current_setting('test.owner')::uuid);
select is(public.is_team_owner('11111111-1111-1111-1111-111111111111'), true, 'Owner is team owner');
select is(public.can_create_project('11111111-1111-1111-1111-111111111111'), true, 'Owner can create Project');
select is(public.is_project_owner('22222222-2222-2222-2222-222222222222'), true, 'Owner is project owner via team');
select is(public.can_manage_board('22222222-2222-2222-2222-222222222222'), true, 'Owner can manage board');
select is(public.can_manage_members('22222222-2222-2222-2222-222222222222'), true, 'Owner can manage members');

-- Admin
select pg_temp.as_user(current_setting('test.admin')::uuid);
select is(public.can_create_project('11111111-1111-1111-1111-111111111111'), true, 'Admin can create Project');
select is(public.is_project_owner('22222222-2222-2222-2222-222222222222'), false, 'Admin is not project owner');
select is(public.can_manage_members('22222222-2222-2222-2222-222222222222'), true, 'Admin can manage members');
select is(public.can_manage_board('22222222-2222-2222-2222-222222222222'), true, 'Admin can manage board');

-- Manager
select pg_temp.as_user(current_setting('test.manager')::uuid);
select is(public.can_create_project('11111111-1111-1111-1111-111111111111'), false, 'Manager cannot create Project');
select is(public.can_manage_members('22222222-2222-2222-2222-222222222222'), false, 'Manager cannot manage members');
select is(public.can_create_tasks('22222222-2222-2222-2222-222222222222'), true, 'Manager can create tasks');
select is(public.can_manage_board('22222222-2222-2222-2222-222222222222'), true, 'Manager can manage board');

-- Contributor
select pg_temp.as_user(current_setting('test.contributor')::uuid);
select is(public.can_edit_tasks('22222222-2222-2222-2222-222222222222'), true, 'Contributor can edit tasks');
select is(public.can_create_tasks('22222222-2222-2222-2222-222222222222'), false, 'Contributor cannot create tasks');

-- Viewer
select pg_temp.as_user(current_setting('test.viewer')::uuid);
select is(public.can_view_project('22222222-2222-2222-2222-222222222222'), true, 'Viewer can view project');
select is(public.can_edit_tasks('22222222-2222-2222-2222-222222222222'), false, 'Viewer cannot edit tasks');

-- Outsider
select pg_temp.as_user(current_setting('test.outsider')::uuid);
select is(public.can_view_project('22222222-2222-2222-2222-222222222222'), false, 'Outsider cannot view project');

select * from finish();
rollback;
