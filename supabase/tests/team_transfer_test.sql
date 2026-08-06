-- Transfer Team ownership RPC
begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

select set_config('test.owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('test.member', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select set_config('test.outsider', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);

set local role postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  (current_setting('test.owner')::uuid, 'authenticated', 'authenticated', 'owner@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.member')::uuid, 'authenticated', 'authenticated', 'member@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.outsider')::uuid, 'authenticated', 'authenticated', 'out@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
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
values (
  '11111111-1111-1111-1111-111111111111',
  current_setting('test.member')::uuid,
  'manager'::public.project_member_role
)
on conflict (team_id, user_id) do nothing;

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

-- Non-owner cannot transfer
select pg_temp.as_user(current_setting('test.member')::uuid);
select throws_ok(
  $$select public.transfer_team_ownership(
    '11111111-1111-1111-1111-111111111111'::uuid,
    current_setting('test.member')::uuid
  )$$,
  'Only the owner can transfer ownership',
  'non-owner cannot transfer'
);

-- Owner transfers to member
select pg_temp.as_user(current_setting('test.owner')::uuid);
select is(
  (select owner_id from public.transfer_team_ownership(
    '11111111-1111-1111-1111-111111111111'::uuid,
    current_setting('test.member')::uuid
  )),
  current_setting('test.member')::uuid,
  'owner can transfer to current member'
);

select is(
  (select role from public.team_members
   where team_id = '11111111-1111-1111-1111-111111111111'
     and user_id = current_setting('test.owner')::uuid),
  'admin'::public.project_member_role,
  'former owner becomes admin member'
);

select * from finish();
rollback;
