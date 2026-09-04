-- Project DELETE must cascade the Description system custom field.
-- Direct DELETE of a system field must still be blocked while the Project exists.
begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

select set_config('test.owner', 'b1111111-1111-1111-1111-111111111111', true);
select set_config('test.team', 'b2222222-2222-2222-2222-222222222222', true);
select set_config('test.project', 'b3333333-3333-3333-3333-333333333333', true);

set local role postgres;

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  current_setting('test.owner')::uuid,
  'authenticated',
  'authenticated',
  'sys-cf-cascade-owner@test.com',
  crypt('x', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.profiles (id, username)
values (current_setting('test.owner')::uuid, 'sys-cf-cascade-owner')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values (
  current_setting('test.team')::uuid,
  current_setting('test.owner')::uuid,
  'System CF Cascade Fixture Team'
)
on conflict (id) do nothing;

insert into public.projects (id, team_id, name, slug)
values (
  current_setting('test.project')::uuid,
  current_setting('test.team')::uuid,
  'System CF Cascade Fixture',
  'sys-cf-cascade-fixture'
)
on conflict (id) do nothing;

select ok(
  (
    select count(*)::integer
    from public.custom_field_definitions as d
    where d.project_id = current_setting('test.project')::uuid
      and d.system_key = 'description'
  ) = 1,
  'fixture Project has Description system custom field'
);

select throws_ok(
  format(
    'delete from public.custom_field_definitions
     where project_id = %L and system_key = %L',
    current_setting('test.project'),
    'description'
  ),
  'P0001',
  'System custom fields cannot be deleted',
  'direct delete of Description system field is still blocked'
);

select lives_ok(
  format(
    'delete from public.projects where id = %L',
    current_setting('test.project')
  ),
  'Project DELETE cascades the Description system custom field'
);

select ok(
  (
    select count(*)::integer
    from public.custom_field_definitions as d
    where d.project_id = current_setting('test.project')::uuid
  ) = 0,
  'system custom fields are gone after Project DELETE'
);

select * from finish();
rollback;
