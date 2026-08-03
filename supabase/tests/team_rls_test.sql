-- RLS: Project access only via Team membership (seam 2)
begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

select set_config('test.owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('test.member', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select set_config('test.outsider', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);

set local role postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  (current_setting('test.owner')::uuid, 'authenticated', 'authenticated', 'owner@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.member')::uuid, 'authenticated', 'authenticated', 'member@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.outsider')::uuid, 'authenticated', 'authenticated', 'outsider@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, username)
values
  (current_setting('test.owner')::uuid, 'owner'),
  (current_setting('test.member')::uuid, 'member'),
  (current_setting('test.outsider')::uuid, 'outsider')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values ('11111111-1111-1111-1111-111111111111', current_setting('test.owner')::uuid, 'Acme')
on conflict (id) do nothing;

insert into public.team_members (team_id, user_id, role)
values ('11111111-1111-1111-1111-111111111111', current_setting('test.member')::uuid, 'viewer')
on conflict do nothing;

insert into public.projects (id, team_id, name, slug)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Repo A',
  'repo-a'
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

-- Owner sees project
select pg_temp.as_user(current_setting('test.owner')::uuid);
select is(
  (select count(*)::int from public.projects where id = '22222222-2222-2222-2222-222222222222'),
  1,
  'Owner can select project via team ownership'
);

-- Member sees project
select pg_temp.as_user(current_setting('test.member')::uuid);
select is(
  (select count(*)::int from public.projects where id = '22222222-2222-2222-2222-222222222222'),
  1,
  'Team member can select project'
);

-- Outsider cannot see project
select pg_temp.as_user(current_setting('test.outsider')::uuid);
select is(
  (select count(*)::int from public.projects where id = '22222222-2222-2222-2222-222222222222'),
  0,
  'Outsider cannot select project'
);

-- Admin-equivalent: member cannot delete project (Owner only)
select pg_temp.as_user(current_setting('test.member')::uuid);
select is(
  (select count(*)::int from public.projects
   where id = '22222222-2222-2222-2222-222222222222'
   and public.is_project_owner(id)),
  0,
  'Viewer is not project owner for delete'
);

-- Unique (team_id, github_repo_id)
set local role postgres;
select throws_ok(
  $$
    insert into public.projects (team_id, name, slug, github_repo_id)
    values (
      '11111111-1111-1111-1111-111111111111',
      'Dup',
      'dup',
      42
    );
    insert into public.projects (team_id, name, slug, github_repo_id)
    values (
      '11111111-1111-1111-1111-111111111111',
      'Dup2',
      'dup2',
      42
    );
  $$,
  '23505',
  null,
  'duplicate (team_id, github_repo_id) rejected'
);

select * from finish();
rollback;
