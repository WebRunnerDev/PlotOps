-- Per-user Team caps + per-Team Project cap (ADR 0032)
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

select set_config('test.owner', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
select set_config('test.joiner', 'bbbbbbbb-0000-0000-0000-00000000000b', true);

set local role postgres;

-- Two principals under test plus 12 one-Team hosts for the joiner to join.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  (current_setting('test.owner')::uuid, 'authenticated', 'authenticated', 'cap-owner@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.joiner')::uuid, 'authenticated', 'authenticated', 'cap-joiner@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select
  ('eeeeeeee-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'authenticated', 'authenticated',
  'cap-host-' || n || '@test.com',
  crypt('x', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 12) as n
on conflict (id) do nothing;

insert into public.profiles (id, username)
values
  (current_setting('test.owner')::uuid, 'cap-owner'),
  (current_setting('test.joiner')::uuid, 'cap-joiner')
on conflict (id) do nothing;

insert into public.profiles (id, username)
select ('eeeeeeee-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'cap-host-' || n
from generate_series(1, 12) as n
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Cap values are the ones the app mirrors
-- ---------------------------------------------------------------------------

select is(public.teams_owned_cap(), 3, 'owned-Team cap is 3');
select is(public.team_memberships_cap(), 10, 'joined-Team cap is 10');
select is(public.team_projects_cap(), 10, 'Projects-per-Team cap is 10');

-- ---------------------------------------------------------------------------
-- Owned Teams: 3 fit, the 4th is rejected
-- ---------------------------------------------------------------------------

insert into public.teams (owner_id, name)
select current_setting('test.owner')::uuid, 'Owned ' || n
from generate_series(1, 3) as n;

select is(
  (select count(*)::integer from public.teams
   where owner_id = current_setting('test.owner')::uuid),
  3,
  'three owned Teams fit under the cap'
);

select throws_ok(
  $$insert into public.teams (owner_id, name)
    values ('aaaaaaaa-0000-0000-0000-00000000000a'::uuid, 'Overflow')$$,
  'P0001',
  null,
  'a fourth owned Team is rejected'
);

-- ---------------------------------------------------------------------------
-- Joined Teams: 10 fit, the 11th is rejected
-- ---------------------------------------------------------------------------

-- One host per Team keeps every host inside the owned cap.
insert into public.teams (id, owner_id, name)
select
  ('dddddddd-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  ('eeeeeeee-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'Host ' || n
from generate_series(1, 12) as n;

-- A Team the joiner owns, for the transfer-demotion exemption below.
insert into public.teams (id, owner_id, name)
values (
  'dddddddd-0000-0000-0000-000000000099'::uuid,
  'bbbbbbbb-0000-0000-0000-00000000000b'::uuid,
  'Joiner own'
);

insert into public.team_members (team_id, user_id, role)
select
  ('dddddddd-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  current_setting('test.joiner')::uuid,
  'viewer'::public.project_member_role
from generate_series(1, 10) as n;

select is(
  (select count(*)::integer from public.team_members
   where user_id = current_setting('test.joiner')::uuid),
  10,
  'ten joined Teams fit under the cap'
);

select throws_ok(
  $$insert into public.team_members (team_id, user_id, role)
    values (
      'dddddddd-0000-0000-0000-000000000011'::uuid,
      'bbbbbbbb-0000-0000-0000-00000000000b'::uuid,
      'viewer'::public.project_member_role
    )$$,
  'P0001',
  null,
  'an eleventh joined Team is rejected'
);

-- transfer_team_ownership demotes the Owner to a Member row while
-- teams.owner_id still points at them — that row is exempt from the cap.
select lives_ok(
  $$insert into public.team_members (team_id, user_id, role)
    values (
      'dddddddd-0000-0000-0000-000000000099'::uuid,
      'bbbbbbbb-0000-0000-0000-00000000000b'::uuid,
      'admin'::public.project_member_role
    )$$,
  'the Owner may take a Member row on their own Team at the cap'
);

-- ---------------------------------------------------------------------------
-- Ownership transfer cannot push a user past the owned cap
-- ---------------------------------------------------------------------------

select throws_ok(
  $$update public.teams
    set owner_id = 'aaaaaaaa-0000-0000-0000-00000000000a'::uuid
    where id = 'dddddddd-0000-0000-0000-000000000001'::uuid$$,
  'P0001',
  null,
  'transferring onto a user who already owns the cap is rejected'
);

select lives_ok(
  $$update public.teams
    set name = 'Renamed'
    where id = 'dddddddd-0000-0000-0000-000000000001'::uuid$$,
  'renaming a Team does not re-check the owned cap'
);

-- ---------------------------------------------------------------------------
-- Projects per Team: 10 fit, the 11th is rejected
-- ---------------------------------------------------------------------------

insert into public.projects (team_id, name, slug)
select
  'dddddddd-0000-0000-0000-000000000001'::uuid,
  'Project ' || n,
  'project-' || n
from generate_series(1, 10) as n;

select is(
  (select count(*)::integer from public.projects
   where team_id = 'dddddddd-0000-0000-0000-000000000001'::uuid),
  10,
  'ten Projects fit under the per-Team cap'
);

select throws_ok(
  $$insert into public.projects (team_id, name, slug)
    values (
      'dddddddd-0000-0000-0000-000000000001'::uuid,
      'Overflow',
      'overflow'
    )$$,
  'P0001',
  null,
  'an eleventh Project in the same Team is rejected'
);

select lives_ok(
  $$insert into public.projects (team_id, name, slug)
    values (
      'dddddddd-0000-0000-0000-000000000002'::uuid,
      'Elsewhere',
      'elsewhere'
    )$$,
  'the cap is per Team, not global'
);

select * from finish();
rollback;
