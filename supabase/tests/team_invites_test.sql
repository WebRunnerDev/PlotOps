-- Team invite redeem RPCs (seam 3) + open invite multi-use (wave 2.1)
begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

select set_config('test.owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('test.invitee', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select set_config('test.claimer', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
select set_config('test.hijacker', 'dddddddd-dddd-dddd-dddd-dddddddddddd', true);
select set_config('test.opener', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true);
select set_config('test.opener2', 'ffffffff-ffff-ffff-ffff-ffffffffffff', true);

set local role postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  (current_setting('test.owner')::uuid, 'authenticated', 'authenticated', 'owner@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.invitee')::uuid, 'authenticated', 'authenticated', 'invitee@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.claimer')::uuid, 'authenticated', 'authenticated', 'other@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.hijacker')::uuid, 'authenticated', 'authenticated', 'hijacker@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.opener')::uuid, 'authenticated', 'authenticated', 'opener@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.opener2')::uuid, 'authenticated', 'authenticated', 'opener2@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, username)
values
  (current_setting('test.owner')::uuid, 'owner'),
  (current_setting('test.invitee')::uuid, 'invitee'),
  (current_setting('test.claimer')::uuid, 'claimer'),
  (current_setting('test.hijacker')::uuid, 'hijacker'),
  (current_setting('test.opener')::uuid, 'opener'),
  (current_setting('test.opener2')::uuid, 'opener2')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values ('11111111-1111-1111-1111-111111111111', current_setting('test.owner')::uuid, 'Acme')
on conflict (id) do nothing;

insert into public.team_invites (id, team_id, email, role, token, status, invited_by)
values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'invitee@test.com',
  'contributor',
  'token-match-email',
  'pending',
  current_setting('test.owner')::uuid
),
(
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  'target@test.com',
  'viewer',
  'token-claim',
  'pending',
  current_setting('test.owner')::uuid
)
on conflict (id) do nothing;

insert into public.team_invites (id, team_id, email, kind, role, token, status, invited_by, expires_at)
values (
  '55555555-5555-5555-5555-555555555555',
  '11111111-1111-1111-1111-111111111111',
  null,
  'open',
  'contributor',
  'token-open',
  'pending',
  current_setting('test.owner')::uuid,
  now() + interval '7 days'
),
(
  '66666666-6666-6666-6666-666666666666',
  '11111111-1111-1111-1111-111111111111',
  null,
  'open',
  'viewer',
  'token-open-expired',
  'pending',
  current_setting('test.owner')::uuid,
  now() - interval '1 hour'
),
(
  '77777777-7777-7777-7777-777777777777',
  '11111111-1111-1111-1111-111111111111',
  null,
  'open',
  'viewer',
  'token-open-revoked',
  'revoked',
  current_setting('test.owner')::uuid,
  null
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

-- Preview by token requires auth; returns flags instead of email/claimed_by
select throws_ok(
  $$select public.get_team_invite_by_token('token-match-email')$$,
  'P0001',
  'Not authenticated',
  'get_team_invite_by_token rejects unauthenticated callers'
);

select pg_temp.as_user(current_setting('test.invitee')::uuid);
select ok(
  (select team_id from public.get_team_invite_by_token('token-match-email'))
    = '11111111-1111-1111-1111-111111111111'::uuid,
  'get_team_invite_by_token returns team'
);
select ok(
  (select email_matches from public.get_team_invite_by_token('token-match-email')),
  'get_team_invite_by_token marks matching email'
);
select ok(
  not (select is_claimed from public.get_team_invite_by_token('token-match-email')),
  'get_team_invite_by_token marks unclaimed invite'
);
select is(
  (select kind from public.get_team_invite_by_token('token-match-email')),
  'email',
  'get_team_invite_by_token returns email kind'
);

-- Accept with matching email
select pg_temp.as_user(current_setting('test.invitee')::uuid);
select lives_ok(
  $$select public.accept_team_invite('token-match-email')$$,
  'matching email can accept team invite'
);
select is(
  (select role from public.team_members
   where team_id = '11111111-1111-1111-1111-111111111111'
     and user_id = current_setting('test.invitee')::uuid),
  'contributor'::public.project_member_role,
  'accept creates team_members row'
);

-- Claim with mismatched email
select pg_temp.as_user(current_setting('test.claimer')::uuid);
select is(
  (select claimed_by from public.claim_team_invite('token-claim')),
  current_setting('test.claimer')::uuid,
  'claim sets claimed_by'
);

-- Same caller may reclaim idempotently
select is(
  (select claimed_by from public.claim_team_invite('token-claim')),
  current_setting('test.claimer')::uuid,
  're-claim by same user keeps claimed_by'
);

-- Later caller cannot steal the claim
select pg_temp.as_user(current_setting('test.hijacker')::uuid);
select throws_ok(
  $$select public.claim_team_invite('token-claim')$$,
  'P0001',
  'Invite already claimed by another user',
  'second caller cannot overwrite claimed_by'
);

select ok(
  (select is_claimed and not claimed_by_me
   from public.get_team_invite_by_token('token-claim')),
  'preview shows invite claimed by another user'
);

set local role postgres;
select is(
  (select claimed_by from public.team_invites where token = 'token-claim'),
  current_setting('test.claimer')::uuid,
  'original claimer remains after hijack attempt'
);

-- Owner confirms claimed invite
select pg_temp.as_user(current_setting('test.owner')::uuid);
select lives_ok(
  $$select public.confirm_team_invite(
    '44444444-4444-4444-4444-444444444444'::uuid,
    current_setting('test.claimer')::uuid
  )$$,
  'owner can confirm claimed invite'
);

select is(
  (select role from public.team_members
   where team_id = '11111111-1111-1111-1111-111111111111'
     and user_id = current_setting('test.claimer')::uuid),
  'viewer'::public.project_member_role,
  'confirm creates team_members for claimer'
);

-- ---------------------------------------------------------------------------
-- Open invite: preview + multi-use accept + reject claim/confirm + expire/revoke
-- ---------------------------------------------------------------------------

select pg_temp.as_user(current_setting('test.opener')::uuid);
select is(
  (select kind from public.get_team_invite_by_token('token-open')),
  'open',
  'open invite preview returns kind open'
);
select ok(
  not (select email_matches from public.get_team_invite_by_token('token-open')),
  'open invite preview has no email match'
);

select lives_ok(
  $$select public.accept_team_invite('token-open')$$,
  'any signed-in non-member can accept open invite'
);
select is(
  (select role from public.team_members
   where team_id = '11111111-1111-1111-1111-111111111111'
     and user_id = current_setting('test.opener')::uuid),
  'contributor'::public.project_member_role,
  'open accept creates team_members row'
);

set local role postgres;
select is(
  (select status::text from public.team_invites where token = 'token-open'),
  'pending',
  'open invite stays pending after redeem'
);
select is(
  (select redeem_count from public.team_invites where token = 'token-open'),
  1,
  'open accept increments redeem_count'
);

select pg_temp.as_user(current_setting('test.opener')::uuid);
select throws_ok(
  $$select public.accept_team_invite('token-open')$$,
  'P0001',
  'Already a member of this team',
  'open accept rejects existing member'
);

select pg_temp.as_user(current_setting('test.opener2')::uuid);
select lives_ok(
  $$select public.accept_team_invite('token-open')$$,
  'second user can redeem same open invite'
);

set local role postgres;
select is(
  (select redeem_count from public.team_invites where token = 'token-open'),
  2,
  'second open redeem increments redeem_count again'
);

select pg_temp.as_user(current_setting('test.hijacker')::uuid);
select throws_ok(
  $$select public.claim_team_invite('token-open')$$,
  'P0001',
  'Open invites cannot be claimed',
  'claim rejects open kind'
);

select pg_temp.as_user(current_setting('test.owner')::uuid);
select throws_ok(
  $$select public.confirm_team_invite(
    '55555555-5555-5555-5555-555555555555'::uuid,
    current_setting('test.hijacker')::uuid
  )$$,
  'P0001',
  'Open invites cannot be confirmed',
  'confirm rejects open kind'
);

select pg_temp.as_user(current_setting('test.hijacker')::uuid);
select throws_ok(
  $$select public.accept_team_invite('token-open-expired')$$,
  'P0001',
  'Invite has expired',
  'expired open invite fails safely'
);
select throws_ok(
  $$select public.accept_team_invite('token-open-revoked')$$,
  'P0001',
  'Invite has been revoked',
  'revoked open invite fails safely'
);

select * from finish();
rollback;
