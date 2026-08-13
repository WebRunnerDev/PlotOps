-- Parent Task cannot enter Done / archive / delete while Subtasks are open or exist.
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

select set_config('test.owner', 'e1111111-1111-1111-1111-111111111111', true);
select set_config('test.team', 'e2222222-2222-2222-2222-222222222222', true);
select set_config('test.project', 'e3333333-3333-3333-3333-333333333333', true);
select set_config('test.parent', 'e4444444-4444-4444-4444-444444444441', true);
select set_config('test.solo', 'e4444444-4444-4444-4444-444444444442', true);

set local role postgres;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  current_setting('test.owner')::uuid,
  'authenticated', 'authenticated',
  'parent-gate-owner@test.com',
  crypt('x', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, now(), now()
)
on conflict (id) do nothing;

insert into public.profiles (id, username)
values (current_setting('test.owner')::uuid, 'parent-gate-owner')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values (
  current_setting('test.team')::uuid,
  current_setting('test.owner')::uuid,
  'Parent Gate Fixture Team'
)
on conflict (id) do nothing;

insert into public.projects (id, team_id, name, slug)
values (
  current_setting('test.project')::uuid,
  current_setting('test.team')::uuid,
  'Parent Gate Fixture',
  'parent-gate-fixture'
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
  current_setting('test.solo')::uuid,
  current_setting('test.project')::uuid,
  b.id,
  'Solo Task',
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

create or replace function pg_temp.board_id()
returns uuid
language sql
as $$
  select b.id
  from public.boards as b
  where b.project_id = current_setting('test.project')::uuid
  limit 1
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

select pg_temp.as_user(current_setting('test.owner')::uuid);

select public.create_subtask(
  current_setting('test.parent')::uuid,
  'Open child'
);

select lives_ok(
  format(
    'select pg_temp.move_to(%L::uuid, %L)',
    current_setting('test.parent'),
    'in_progress'
  ),
  'Parent Task may leave To Do while a Subtask is open'
);

select throws_ok(
  format(
    'select pg_temp.move_to(%L::uuid, %L)',
    current_setting('test.parent'),
    'done'
  ),
  'P0001',
  'A Parent Task cannot enter Done while Subtasks are not Done',
  'persist_task_moves refuses Parent Task Done while a Subtask is open'
);

select lives_ok(
  format(
    'select pg_temp.move_to(%L::uuid, %L)',
    current_setting('test.solo'),
    'done'
  ),
  'A Task with no Subtasks may enter Done'
);

select throws_ok(
  format(
    'select public.archive_tasks(array[%L]::uuid[])',
    current_setting('test.parent')
  ),
  'P0001',
  'A Parent Task cannot be archived while Subtasks are still active',
  'archive_tasks refuses a Parent Task while a Subtask is active'
);

update public.tasks as t
set status = 'done'
where t.parent_id = current_setting('test.parent')::uuid;

select lives_ok(
  format(
    'select pg_temp.move_to(%L::uuid, %L)',
    current_setting('test.parent'),
    'done'
  ),
  'Parent Task may enter Done when every Subtask is Done'
);

update public.tasks as t
set archived_at = now()
where t.parent_id = current_setting('test.parent')::uuid;

select lives_ok(
  format(
    'select public.archive_tasks(array[%L]::uuid[])',
    current_setting('test.parent')
  ),
  'Parent Task may be archived when every Subtask is archived'
);

select throws_ok(
  format(
    'delete from public.tasks where id = %L::uuid',
    current_setting('test.parent')
  ),
  'P0001',
  'A Parent Task cannot be deleted while Subtasks exist',
  'Hard-delete refuses a Parent Task while a Subtask exists'
);

delete from public.tasks as t
where t.parent_id = current_setting('test.parent')::uuid;

select lives_ok(
  format(
    'delete from public.tasks where id = %L::uuid',
    current_setting('test.parent')
  ),
  'Parent Task may be deleted after every Subtask is gone'
);

select * from finish();
rollback;
