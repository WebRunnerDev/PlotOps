-- Project DELETE must cascade boards even when only one board remains.
-- Direct last-board DELETE must still be blocked while the Project exists.
begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

select set_config('test.owner', 'dddddddd-dddd-dddd-dddd-dddddddddddd', true);
select set_config('test.team', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true);
select set_config('test.project', 'ffffffff-ffff-ffff-ffff-ffffffffffff', true);

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
  'cascade-owner@test.com',
  crypt('x', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.profiles (id, username)
values (current_setting('test.owner')::uuid, 'cascade-owner')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values (
  current_setting('test.team')::uuid,
  current_setting('test.owner')::uuid,
  'Cascade Delete Fixture Team'
)
on conflict (id) do nothing;

insert into public.projects (id, team_id, name, slug)
values (
  current_setting('test.project')::uuid,
  current_setting('test.team')::uuid,
  'Cascade Delete Fixture',
  'cascade-delete-fixture'
)
on conflict (id) do nothing;

select ok(
  (
    select count(*)::integer
    from public.boards as b
    where b.project_id = current_setting('test.project')::uuid
  ) = 1,
  'fixture Project has a default Board'
);

select throws_ok(
  format(
    'delete from public.boards where project_id = %L',
    current_setting('test.project')
  ),
  'P0001',
  'Cannot delete the last board in a project',
  'direct delete of last Board is still blocked'
);

select lives_ok(
  format(
    'delete from public.projects where id = %L',
    current_setting('test.project')
  ),
  'Project DELETE cascades the last Board'
);

select * from finish();
rollback;
