-- confirm_team_invite: pending + claimed by the confirmed user; no role changes
-- for existing members; owner-only admin invites (ADR 0003, ADR 0004).
begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

select set_config('test.team', '11111111-1111-1111-1111-111111111111', true);
select set_config('test.owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('test.admin', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select set_config('test.claimer', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
select set_config('test.other', 'dddddddd-dddd-dddd-dddd-dddddddddddd', true);
select set_config('test.outsider', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true);
select set_config('test.admin2', 'ffffffff-ffff-ffff-ffff-ffffffffffff', true);
select set_config('test.viewer', '99999999-9999-9999-9999-999999999999', true);

set local role postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  (current_setting('test.owner')::uuid, 'authenticated', 'authenticated', 'owner@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.admin')::uuid, 'authenticated', 'authenticated', 'admin@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.claimer')::uuid, 'authenticated', 'authenticated', 'claimer@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.other')::uuid, 'authenticated', 'authenticated', 'other@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.outsider')::uuid, 'authenticated', 'authenticated', 'outsider@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.admin2')::uuid, 'authenticated', 'authenticated', 'admin2@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.viewer')::uuid, 'authenticated', 'authenticated', 'viewer@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, username)
values
  (current_setting('test.owner')::uuid, 'owner'),
  (current_setting('test.admin')::uuid, 'admin'),
  (current_setting('test.claimer')::uuid, 'claimer'),
  (current_setting('test.other')::uuid, 'other'),
  (current_setting('test.outsider')::uuid, 'outsider'),
  (current_setting('test.admin2')::uuid, 'admin2'),
  (current_setting('test.viewer')::uuid, 'viewer')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values (current_setting('test.team')::uuid, current_setting('test.owner')::uuid, 'Acme')
on conflict (id) do nothing;

insert into public.team_members (team_id, user_id, role)
values
  (current_setting('test.team')::uuid, current_setting('test.admin')::uuid, 'admin'),
  (current_setting('test.team')::uuid, current_setting('test.admin2')::uuid, 'admin'),
  (current_setting('test.team')::uuid, current_setting('test.viewer')::uuid, 'viewer')
on conflict do nothing;

-- Email invites (kind defaults to 'email'):
--   c1  contributor, claimed by claimer          → happy path
--   c2  contributor, claimed by other            → confirm with a different user
--   c3  contributor, not claimed                 → unclaimed
--   c4  contributor, claimed by admin2 (member)  → existing admin member
--   c5  contributor, claimed by viewer (member)  → existing viewer member
--   c6  admin,       claimed by outsider         → owner-only admin rule
--   c7  contributor, accepted, claimed by admin2 → already accepted
insert into public.team_invites (id, team_id, email, role, token, status, invited_by, claimed_by)
values
  ('c1c1c1c1-0000-0000-0000-000000000001', current_setting('test.team')::uuid, 'c1@test.com', 'contributor', 'token-c1', 'pending', current_setting('test.owner')::uuid, current_setting('test.claimer')::uuid),
  ('c2c2c2c2-0000-0000-0000-000000000002', current_setting('test.team')::uuid, 'c2@test.com', 'contributor', 'token-c2', 'pending', current_setting('test.owner')::uuid, current_setting('test.other')::uuid),
  ('c3c3c3c3-0000-0000-0000-000000000003', current_setting('test.team')::uuid, 'c3@test.com', 'contributor', 'token-c3', 'pending', current_setting('test.owner')::uuid, null),
  ('c4c4c4c4-0000-0000-0000-000000000004', current_setting('test.team')::uuid, 'c4@test.com', 'contributor', 'token-c4', 'pending', current_setting('test.owner')::uuid, current_setting('test.admin2')::uuid),
  ('c5c5c5c5-0000-0000-0000-000000000005', current_setting('test.team')::uuid, 'c5@test.com', 'contributor', 'token-c5', 'pending', current_setting('test.owner')::uuid, current_setting('test.viewer')::uuid),
  ('c6c6c6c6-0000-0000-0000-000000000006', current_setting('test.team')::uuid, 'c6@test.com', 'admin', 'token-c6', 'pending', current_setting('test.owner')::uuid, current_setting('test.outsider')::uuid),
  ('c7c7c7c7-0000-0000-0000-000000000007', current_setting('test.team')::uuid, 'c7@test.com', 'contributor', 'token-c7', 'accepted', current_setting('test.owner')::uuid, current_setting('test.admin2')::uuid)
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

-- ---------------------------------------------------------------------------
-- Happy path: admin confirms the user who claimed the invite
-- ---------------------------------------------------------------------------

select pg_temp.as_user(current_setting('test.admin')::uuid);
select lives_ok(
  $$select public.confirm_team_invite(
    'c1c1c1c1-0000-0000-0000-000000000001'::uuid,
    current_setting('test.claimer')::uuid
  )$$,
  'admin can confirm a pending invite for the user who claimed it'
);

set local role postgres;
select is(
  (select role from public.team_members
   where team_id = current_setting('test.team')::uuid
     and user_id = current_setting('test.claimer')::uuid),
  'contributor'::public.project_member_role,
  'confirm adds the claimer with the invite role'
);
select ok(
  (select status = 'accepted' and accepted_by = current_setting('test.claimer')::uuid
   from public.team_invites where id = 'c1c1c1c1-0000-0000-0000-000000000001'),
  'confirm marks the invite accepted by the claimer'
);

-- ---------------------------------------------------------------------------
-- Already accepted invite cannot be confirmed again
-- ---------------------------------------------------------------------------

select pg_temp.as_user(current_setting('test.admin')::uuid);
select throws_ok(
  $$select public.confirm_team_invite(
    'c1c1c1c1-0000-0000-0000-000000000001'::uuid,
    current_setting('test.claimer')::uuid
  )$$,
  'P0001',
  'Invite cannot be confirmed',
  'accepted invite cannot be confirmed again'
);
select throws_ok(
  $$select public.confirm_team_invite(
    'c7c7c7c7-0000-0000-0000-000000000007'::uuid,
    current_setting('test.admin2')::uuid
  )$$,
  'P0001',
  'Invite cannot be confirmed',
  'accepted invite cannot be confirmed for its claimer'
);
select throws_ok(
  $$select public.confirm_team_invite(
    'c1c1c1c1-0000-0000-0000-000000000001'::uuid,
    current_setting('test.admin2')::uuid
  )$$,
  'P0001',
  'Invite cannot be confirmed',
  'accepted invite cannot be confirmed for another user'
);

set local role postgres;
select is(
  (select role from public.team_members
   where team_id = current_setting('test.team')::uuid
     and user_id = current_setting('test.admin2')::uuid),
  'admin'::public.project_member_role,
  'admin2 role unchanged after accepted-invite attempts'
);

-- ---------------------------------------------------------------------------
-- p_user_id must be the user who claimed the invite
-- ---------------------------------------------------------------------------

select pg_temp.as_user(current_setting('test.admin')::uuid);
select throws_ok(
  $$select public.confirm_team_invite(
    'c2c2c2c2-0000-0000-0000-000000000002'::uuid,
    current_setting('test.outsider')::uuid
  )$$,
  'P0001',
  'User has not claimed this invite',
  'confirm rejects a user other than the claimer'
);
select throws_ok(
  $$select public.confirm_team_invite(
    'c2c2c2c2-0000-0000-0000-000000000002'::uuid,
    current_setting('test.admin2')::uuid
  )$$,
  'P0001',
  'User has not claimed this invite',
  'confirm rejects an existing member who did not claim the invite'
);

set local role postgres;
select ok(
  not exists (
    select 1 from public.team_members
    where team_id = current_setting('test.team')::uuid
      and user_id = current_setting('test.outsider')::uuid
  ),
  'non-claimer is not added to the team'
);
select ok(
  (select status = 'pending' and accepted_by is null
     and claimed_by = current_setting('test.other')::uuid
   from public.team_invites where id = 'c2c2c2c2-0000-0000-0000-000000000002'),
  'invite unchanged after confirm with a non-claimer'
);
select is(
  (select role from public.team_members
   where team_id = current_setting('test.team')::uuid
     and user_id = current_setting('test.admin2')::uuid),
  'admin'::public.project_member_role,
  'admin2 role unchanged after non-claimer attempt'
);

-- ---------------------------------------------------------------------------
-- Unclaimed invite cannot be confirmed
-- ---------------------------------------------------------------------------

select pg_temp.as_user(current_setting('test.owner')::uuid);
select throws_ok(
  $$select public.confirm_team_invite(
    'c3c3c3c3-0000-0000-0000-000000000003'::uuid,
    current_setting('test.outsider')::uuid
  )$$,
  'P0001',
  'Invite has not been claimed',
  'confirm rejects an unclaimed invite'
);

set local role postgres;
select ok(
  (select status = 'pending' and accepted_by is null
   from public.team_invites where id = 'c3c3c3c3-0000-0000-0000-000000000003'),
  'unclaimed invite stays pending'
);

-- ---------------------------------------------------------------------------
-- Existing members are never changed by confirm
-- ---------------------------------------------------------------------------

select pg_temp.as_user(current_setting('test.admin')::uuid);
select throws_ok(
  $$select public.confirm_team_invite(
    'c4c4c4c4-0000-0000-0000-000000000004'::uuid,
    current_setting('test.admin2')::uuid
  )$$,
  'P0001',
  'Already a member of this team',
  'admin cannot confirm an invite for an existing admin member'
);

select pg_temp.as_user(current_setting('test.owner')::uuid);
select throws_ok(
  $$select public.confirm_team_invite(
    'c4c4c4c4-0000-0000-0000-000000000004'::uuid,
    current_setting('test.admin2')::uuid
  )$$,
  'P0001',
  'Already a member of this team',
  'owner cannot confirm an invite for an existing admin member either'
);
select throws_ok(
  $$select public.confirm_team_invite(
    'c5c5c5c5-0000-0000-0000-000000000005'::uuid,
    current_setting('test.viewer')::uuid
  )$$,
  'P0001',
  'Already a member of this team',
  'confirm rejects an existing viewer member'
);

set local role postgres;
select is(
  (select role from public.team_members
   where team_id = current_setting('test.team')::uuid
     and user_id = current_setting('test.admin2')::uuid),
  'admin'::public.project_member_role,
  'existing admin member keeps their role'
);
select is(
  (select role from public.team_members
   where team_id = current_setting('test.team')::uuid
     and user_id = current_setting('test.viewer')::uuid),
  'viewer'::public.project_member_role,
  'existing viewer member keeps their role'
);
select ok(
  (select bool_and(status = 'pending' and accepted_by is null)
   from public.team_invites
   where id in (
     'c4c4c4c4-0000-0000-0000-000000000004',
     'c5c5c5c5-0000-0000-0000-000000000005'
   )),
  'invites for existing members stay pending'
);

-- ---------------------------------------------------------------------------
-- Owner-only admin invites (ADR 0004)
-- ---------------------------------------------------------------------------

select pg_temp.as_user(current_setting('test.admin')::uuid);
select throws_ok(
  $$select public.confirm_team_invite(
    'c6c6c6c6-0000-0000-0000-000000000006'::uuid,
    current_setting('test.outsider')::uuid
  )$$,
  'P0001',
  'Only the owner can confirm admin invites',
  'admin cannot confirm an admin invite'
);

set local role postgres;
select ok(
  not exists (
    select 1 from public.team_members
    where team_id = current_setting('test.team')::uuid
      and user_id = current_setting('test.outsider')::uuid
  ),
  'admin invite not applied by an admin'
);

select pg_temp.as_user(current_setting('test.owner')::uuid);
select lives_ok(
  $$select public.confirm_team_invite(
    'c6c6c6c6-0000-0000-0000-000000000006'::uuid,
    current_setting('test.outsider')::uuid
  )$$,
  'owner can confirm an admin invite for its claimer'
);

set local role postgres;
select is(
  (select role from public.team_members
   where team_id = current_setting('test.team')::uuid
     and user_id = current_setting('test.outsider')::uuid),
  'admin'::public.project_member_role,
  'owner-confirmed admin invite adds the claimer as admin'
);

select * from finish();
rollback;
