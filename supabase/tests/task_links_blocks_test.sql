-- blocks Task Links: cycle rejection, Contributor write, Done-gate.
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

select set_config('test.owner', 'a1111111-1111-1111-1111-111111111111', true);
select set_config('test.contributor', 'a2222222-2222-2222-2222-222222222222', true);
select set_config('test.team', 'a4444444-4444-4444-4444-444444444444', true);
select set_config('test.project', 'a5555555-5555-5555-5555-555555555555', true);
select set_config('test.blocker', 'a6666666-6666-6666-6666-666666666661', true);
select set_config('test.blocked', 'a6666666-6666-6666-6666-666666666662', true);
select set_config('test.third', 'a6666666-6666-6666-6666-666666666663', true);
select set_config('test.parent', 'a6666666-6666-6666-6666-666666666664', true);
select set_config('test.child', 'a6666666-6666-6666-6666-666666666665', true);

set local role postgres;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    current_setting('test.owner')::uuid,
    'authenticated', 'authenticated',
    'blocks-owner@test.com',
    crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, now(), now()
  ),
  (
    current_setting('test.contributor')::uuid,
    'authenticated', 'authenticated',
    'blocks-contributor@test.com',
    crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

insert into public.profiles (id, username)
values
  (current_setting('test.owner')::uuid, 'blocks-owner'),
  (current_setting('test.contributor')::uuid, 'blocks-contributor')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values (
  current_setting('test.team')::uuid,
  current_setting('test.owner')::uuid,
  'Blocks Fixture Team'
)
on conflict (id) do nothing;

insert into public.team_members (team_id, user_id, role)
values (
  current_setting('test.team')::uuid,
  current_setting('test.contributor')::uuid,
  'contributor'
)
on conflict do nothing;

insert into public.projects (id, team_id, name, slug)
values (
  current_setting('test.project')::uuid,
  current_setting('test.team')::uuid,
  'Blocks Fixture',
  'blocks-fixture'
)
on conflict (id) do nothing;

insert into public.tasks (
  id, project_id, board_id, title, status, position, author_id, task_type
)
select
  current_setting('test.blocker')::uuid,
  current_setting('test.project')::uuid,
  b.id,
  'Blocker',
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
  current_setting('test.blocked')::uuid,
  current_setting('test.project')::uuid,
  t.board_id,
  'Blocked',
  'todo',
  1,
  current_setting('test.owner')::uuid,
  'task'
from public.tasks as t
where t.id = current_setting('test.blocker')::uuid;

insert into public.tasks (
  id, project_id, board_id, title, status, position, author_id, task_type
)
select
  current_setting('test.third')::uuid,
  current_setting('test.project')::uuid,
  t.board_id,
  'Third',
  'todo',
  2,
  current_setting('test.owner')::uuid,
  'task'
from public.tasks as t
where t.id = current_setting('test.blocker')::uuid;

insert into public.tasks (
  id, project_id, board_id, title, status, position, author_id, task_type
)
select
  current_setting('test.parent')::uuid,
  current_setting('test.project')::uuid,
  t.board_id,
  'Parent',
  'todo',
  3,
  current_setting('test.owner')::uuid,
  'task'
from public.tasks as t
where t.id = current_setting('test.blocker')::uuid;

insert into public.tasks (
  id, project_id, board_id, title, status, position, author_id, task_type,
  parent_id
)
select
  current_setting('test.child')::uuid,
  current_setting('test.project')::uuid,
  t.board_id,
  'Child',
  'todo',
  4,
  current_setting('test.owner')::uuid,
  'task',
  t.id
from public.tasks as t
where t.id = current_setting('test.parent')::uuid;

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

create or replace function pg_temp.board_id()
returns uuid
language sql
as $$
  select board_id from public.tasks
  where id = current_setting('test.blocker')::uuid
$$;

create or replace function pg_temp.move_to(p_task_id uuid, p_status text)
returns void
language plpgsql
as $$
begin
  perform public.persist_task_moves(
    pg_temp.board_id(),
    jsonb_build_array(
      jsonb_build_object(
        'id', p_task_id,
        'position', 0,
        'status', p_status
      )
    )
  );
end;
$$;

select pg_temp.as_user(current_setting('test.contributor')::uuid);

select lives_ok(
  format(
    'select public.create_task_link(%L::uuid, %L::uuid, %L)',
    current_setting('test.blocker'),
    current_setting('test.blocked'),
    'blocks'
  ),
  'Contributor can create a blocks Task Link'
);

select throws_ok(
  format(
    'select public.create_task_link(%L::uuid, %L::uuid, %L)',
    current_setting('test.blocked'),
    current_setting('test.blocker'),
    'blocks'
  ),
  'P0001',
  'A cyclic blocks chain is not allowed',
  'Two-Task cyclic blocks chain is rejected'
);

select lives_ok(
  format(
    'select public.create_task_link(%L::uuid, %L::uuid, %L)',
    current_setting('test.blocked'),
    current_setting('test.third'),
    'blocks'
  ),
  'Longer chain A-blocks-B-blocks-C is allowed'
);

select throws_ok(
  format(
    'select public.create_task_link(%L::uuid, %L::uuid, %L)',
    current_setting('test.third'),
    current_setting('test.blocker'),
    'blocks'
  ),
  'P0001',
  'A cyclic blocks chain is not allowed',
  'Longer cyclic blocks chain is rejected'
);

select throws_ok(
  format(
    'select public.create_task_link(%L::uuid, %L::uuid, %L)',
    current_setting('test.parent'),
    current_setting('test.child'),
    'blocks'
  ),
  'P0001',
  'A Task Link cannot connect a Parent Task and its own Subtask',
  'Parent↔Subtask blocks link is rejected'
);

select throws_ok(
  format(
    'select pg_temp.move_to(%L::uuid, %L)',
    current_setting('test.blocked'),
    'done'
  ),
  'P0001',
  'A Task cannot enter Done while an open blocker exists',
  'Blocked Task cannot enter Done'
);

select lives_ok(
  format(
    'select pg_temp.move_to(%L::uuid, %L)',
    current_setting('test.blocked'),
    'in_progress'
  ),
  'Blocked Task can move into a non-Done column'
);

select throws_ok(
  format(
    'select pg_temp.move_to(%L::uuid, %L)',
    current_setting('test.parent'),
    'done'
  ),
  'P0001',
  'A Parent Task cannot enter Done while Subtasks are not Done',
  'Parent incomplete-Subtask Done-gate still applies'
);

select * from finish();
rollback;
