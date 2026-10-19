-- Team admins (not just the Team owner) can create a project, including the
-- INSERT ... RETURNING the client uses. Guards the projects_select_member
-- policy against re-querying public.projects mid-INSERT.
begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

select set_config('test.owner', 'f1111111-1111-1111-1111-111111111111', true);
select set_config('test.admin', 'f2222222-2222-2222-2222-222222222222', true);
select set_config('test.outsider', 'f3333333-3333-3333-3333-333333333333', true);
select set_config('test.team', 'f4444444-4444-4444-4444-444444444444', true);

set local role postgres;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    current_setting('test.owner')::uuid,
    'authenticated', 'authenticated',
    'pir-owner@test.com',
    crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, now(), now()
  ),
  (
    current_setting('test.admin')::uuid,
    'authenticated', 'authenticated',
    'pir-admin@test.com',
    crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, now(), now()
  ),
  (
    current_setting('test.outsider')::uuid,
    'authenticated', 'authenticated',
    'pir-outsider@test.com',
    crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

insert into public.profiles (id, username)
values
  (current_setting('test.owner')::uuid, 'pir-owner'),
  (current_setting('test.admin')::uuid, 'pir-admin'),
  (current_setting('test.outsider')::uuid, 'pir-outsider')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values (
  current_setting('test.team')::uuid,
  current_setting('test.owner')::uuid,
  'PIR Fixture Team'
)
on conflict (id) do nothing;

insert into public.team_members (team_id, user_id, role)
values (
  current_setting('test.team')::uuid,
  current_setting('test.admin')::uuid,
  'admin'
)
on conflict do nothing;

create or replace function pg_temp.as_user(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;

select pg_temp.as_user(current_setting('test.admin')::uuid);

select lives_ok(
  format(
    $$insert into public.projects (team_id, name, slug)
      values (%L::uuid, 'PIR Admin Project', 'pir-admin-project')
      returning id$$,
    current_setting('test.team')
  ),
  'Team admin can insert a project with RETURNING (client createProject path)'
);

select is(
  (select count(*)::int from public.projects where slug = 'pir-admin-project'),
  1,
  'Admin-created project is visible to the admin'
);

select pg_temp.as_user(current_setting('test.owner')::uuid);

select lives_ok(
  format(
    $$insert into public.projects (team_id, name, slug)
      values (%L::uuid, 'PIR Owner Project', 'pir-owner-project')
      returning id$$,
    current_setting('test.team')
  ),
  'Team owner can still insert a project with RETURNING'
);

select pg_temp.as_user(current_setting('test.outsider')::uuid);

select throws_ok(
  format(
    $$insert into public.projects (team_id, name, slug)
      values (%L::uuid, 'PIR Outsider Project', 'pir-outsider-project')$$,
    current_setting('test.team')
  ),
  '42501',
  null,
  'Non-member still cannot insert a project into the Team'
);

select * from finish();
rollback;
