-- Contributor+ can create a Subtask; Viewer cannot; one hierarchy level; clear parent is Manager+.
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

select set_config('test.owner', 'd1111111-1111-1111-1111-111111111111', true);
select set_config('test.contributor', 'd2222222-2222-2222-2222-222222222222', true);
select set_config('test.viewer', 'd3333333-3333-3333-3333-333333333333', true);
select set_config('test.team', 'd4444444-4444-4444-4444-444444444444', true);
select set_config('test.project', 'd5555555-5555-5555-5555-555555555555', true);
select set_config('test.parent', 'd6666666-6666-6666-6666-666666666661', true);
select set_config('test.other_root', 'd6666666-6666-6666-6666-666666666662', true);

set local role postgres;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    current_setting('test.owner')::uuid,
    'authenticated', 'authenticated',
    'subtask-owner@test.com',
    crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, now(), now()
  ),
  (
    current_setting('test.contributor')::uuid,
    'authenticated', 'authenticated',
    'subtask-contributor@test.com',
    crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, now(), now()
  ),
  (
    current_setting('test.viewer')::uuid,
    'authenticated', 'authenticated',
    'subtask-viewer@test.com',
    crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

insert into public.profiles (id, username)
values
  (current_setting('test.owner')::uuid, 'subtask-owner'),
  (current_setting('test.contributor')::uuid, 'subtask-contributor'),
  (current_setting('test.viewer')::uuid, 'subtask-viewer')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values (
  current_setting('test.team')::uuid,
  current_setting('test.owner')::uuid,
  'Subtask Fixture Team'
)
on conflict (id) do nothing;

insert into public.team_members (team_id, user_id, role)
values
  (
    current_setting('test.team')::uuid,
    current_setting('test.contributor')::uuid,
    'contributor'
  ),
  (
    current_setting('test.team')::uuid,
    current_setting('test.viewer')::uuid,
    'viewer'
  )
on conflict do nothing;

insert into public.projects (id, team_id, name, slug)
values (
  current_setting('test.project')::uuid,
  current_setting('test.team')::uuid,
  'Subtask Fixture',
  'subtask-fixture'
)
on conflict (id) do nothing;

insert into public.tasks (
  id, project_id, board_id, title, status, position, author_id, task_type
)
select
  current_setting('test.parent')::uuid,
  current_setting('test.project')::uuid,
  b.id,
  'Parent Task',
  'todo',
  0,
  current_setting('test.owner')::uuid,
  'task'
from public.boards as b
where b.project_id = current_setting('test.project')::uuid
limit 1;

insert into public.tasks (
  id, project_id, board_id, title, status, position, author_id, task_type
)
select
  current_setting('test.other_root')::uuid,
  current_setting('test.project')::uuid,
  b.id,
  'Other root',
  'todo',
  1,
  current_setting('test.owner')::uuid,
  'task'
from public.boards as b
where b.project_id = current_setting('test.project')::uuid
limit 1;

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

-- Viewer cannot create a Subtask
select pg_temp.as_user(current_setting('test.viewer')::uuid);
select throws_ok(
  format(
    'select public.create_subtask(%L::uuid, %L)',
    current_setting('test.parent'),
    'Viewer child'
  ),
  '42501',
  'Only editors can create a Subtask',
  'Viewer cannot create a Subtask'
);

-- Contributor cannot create a root Task
select pg_temp.as_user(current_setting('test.contributor')::uuid);
select throws_ok(
  format(
    $$insert into public.tasks (project_id, board_id, title, status, position, task_type)
      select %L::uuid, b.id, 'Root from contributor', 'todo', 2, 'task'
      from public.boards as b
      where b.project_id = %L::uuid
      limit 1$$,
    current_setting('test.project'),
    current_setting('test.project')
  ),
  '42501',
  null,
  'Contributor cannot insert a root Task'
);

-- Contributor can create a Subtask on the Parent Task's Board
select lives_ok(
  format(
    'select public.create_subtask(%L::uuid, %L)',
    current_setting('test.parent'),
    'Contributor child'
  ),
  'Contributor can create a Subtask'
);

select is(
  (
    select t.board_id
    from public.tasks as t
    where t.parent_id = current_setting('test.parent')::uuid
    order by t.created_at desc
    limit 1
  ),
  (
    select t.board_id
    from public.tasks as t
    where t.id = current_setting('test.parent')::uuid
  ),
  'New Subtask lands on the Parent Task Board'
);

-- Nested Subtask refused
select throws_ok(
  format(
    'select public.create_subtask(%L::uuid, %L)',
    (
      select t.id::text
      from public.tasks as t
      where t.parent_id = current_setting('test.parent')::uuid
      order by t.created_at desc
      limit 1
    ),
    'Nested child'
  ),
  'P0001',
  'A Subtask cannot have Subtasks',
  'Product refuses making a Subtask into a Parent Task'
);

-- Attaching a Parent Task as a Subtask refused
select throws_ok(
  format(
    'update public.tasks set parent_id = %L::uuid where id = %L::uuid',
    current_setting('test.other_root'),
    current_setting('test.parent')
  ),
  'P0001',
  'A Parent Task cannot become a Subtask',
  'Product refuses attaching a Parent Task as a Subtask'
);

-- Contributor cannot clear parent (would mint a root Task)
select throws_ok(
  format(
    'select public.clear_task_parent(%L::uuid)',
    (
      select t.id::text
      from public.tasks as t
      where t.parent_id = current_setting('test.parent')::uuid
      order by t.created_at desc
      limit 1
    )
  ),
  '42501',
  'Only managers can turn a Subtask into a root Task',
  'Contributor cannot remove the Parent relationship'
);

-- Owner/Manager can clear parent; child remains
select pg_temp.as_user(current_setting('test.owner')::uuid);
select lives_ok(
  format(
    'select public.clear_task_parent(%L::uuid)',
    (
      select t.id::text
      from public.tasks as t
      where t.parent_id = current_setting('test.parent')::uuid
      order by t.created_at desc
      limit 1
    )
  ),
  'Manager can remove the Parent relationship'
);

select is(
  (
    select t.parent_id
    from public.tasks as t
    where t.title = 'Contributor child'
  ),
  null,
  'Removing parent turns the child into a root Task'
);

select isnt(
  (
    select t.id
    from public.tasks as t
    where t.title = 'Contributor child'
  ),
  null,
  'Removing parent does not delete the child Task'
);

select * from finish();
rollback;
