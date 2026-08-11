-- Project DELETE must cascade active (non-archived) Tasks.
-- Direct Task DELETE must still require archive while the Project exists.
begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

select set_config('test.owner', 'b1111111-1111-1111-1111-111111111111', true);
select set_config('test.team', 'b2222222-2222-2222-2222-222222222222', true);
select set_config('test.project', 'b3333333-3333-3333-3333-333333333333', true);
select set_config('test.task', 'b4444444-4444-4444-4444-444444444444', true);

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
  'task-cascade-owner@test.com',
  crypt('x', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.profiles (id, username)
values (current_setting('test.owner')::uuid, 'task-cascade-owner')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values (
  current_setting('test.team')::uuid,
  current_setting('test.owner')::uuid,
  'Task Cascade Delete Fixture Team'
)
on conflict (id) do nothing;

insert into public.projects (id, team_id, name, slug)
values (
  current_setting('test.project')::uuid,
  current_setting('test.team')::uuid,
  'Task Cascade Delete Fixture',
  'task-cascade-delete-fixture'
)
on conflict (id) do nothing;

insert into public.tasks (
  id,
  project_id,
  board_id,
  title,
  status,
  position,
  author_id,
  task_type
)
select
  current_setting('test.task')::uuid,
  current_setting('test.project')::uuid,
  b.id,
  'Active task',
  'todo',
  0,
  current_setting('test.owner')::uuid,
  'task'
from public.boards as b
where b.project_id = current_setting('test.project')::uuid
limit 1;

select ok(
  (
    select count(*)::integer
    from public.tasks as t
    where t.id = current_setting('test.task')::uuid
      and t.archived_at is null
  ) = 1,
  'fixture has an active (non-archived) Task'
);

select throws_ok(
  format(
    'delete from public.tasks where id = %L',
    current_setting('test.task')
  ),
  'P0001',
  'Archive the task before deleting',
  'direct delete of active Task is still blocked'
);

select lives_ok(
  format(
    'delete from public.projects where id = %L',
    current_setting('test.project')
  ),
  'Project DELETE cascades active Tasks'
);

select * from finish();
rollback;
