-- Team invite redeem RPCs (seam 3)
begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

select set_config('test.owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('test.invitee', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select set_config('test.claimer', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);

set local role postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  (current_setting('test.owner')::uuid, 'authenticated', 'authenticated', 'owner@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.invitee')::uuid, 'authenticated', 'authenticated', 'invitee@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.claimer')::uuid, 'authenticated', 'authenticated', 'other@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, username)
values
  (current_setting('test.owner')::uuid, 'owner'),
  (current_setting('test.invitee')::uuid, 'invitee'),
  (current_setting('test.claimer')::uuid, 'claimer')
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

-- Preview by token (anon-capable function)
select ok(
  (select team_id from public.get_team_invite_by_token('token-match-email'))
    = '11111111-1111-1111-1111-111111111111'::uuid,
  'get_team_invite_by_token returns team'
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

-- Owner confirms claimed invite
select pg_temp.as_user(current_setting('test.owner')::uuid);
select lives_ok(
  $$select public.confirm_team_invite(
    '44444444-4444-4444-4444-444444444444'::uuid,
    current_setting('test.claimer')::uuid
  )$$,
  'owner can confirm claimed invite'
);

select * from finish();
rollback;
