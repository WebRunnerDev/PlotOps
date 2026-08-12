-- archive_tasks RPC: bulk soft-archive with activity; authz + caps.
begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

select set_config('test.owner', 'c1111111-1111-1111-1111-111111111111', true);
select set_config('test.viewer', 'c5555555-5555-5555-5555-555555555555', true);
select set_config('test.team', 'c2222222-2222-2222-2222-222222222222', true);
select set_config('test.project', 'c3333333-3333-3333-3333-333333333333', true);
select set_config('test.task_a', 'c4444444-4444-4444-4444-444444444441', true);
select set_config('test.task_b', 'c4444444-4444-4444-4444-444444444442', true);

set local role postgres;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    current_setting('test.owner')::uuid,
    'authenticated', 'authenticated',
    'archive-bulk-owner@test.com',
    crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, now(), now()
  ),
  (
    current_setting('test.viewer')::uuid,
    'authenticated', 'authenticated',
    'archive-bulk-viewer@test.com',
    crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

insert into public.profiles (id, username)
values
  (current_setting('test.owner')::uuid, 'archive-bulk-owner'),
  (current_setting('test.viewer')::uuid, 'archive-bulk-viewer')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values (
  current_setting('test.team')::uuid,
  current_setting('test.owner')::uuid,
  'Archive Bulk Fixture Team'
)
on conflict (id) do nothing;

insert into public.team_members (team_id, user_id, role)
values (
  current_setting('test.team')::uuid,
  current_setting('test.viewer')::uuid,
  'viewer'
)
on conflict do nothing;

insert into public.projects (id, team_id, name, slug)
values (
  current_setting('test.project')::uuid,
  current_setting('test.team')::uuid,
  'Archive Bulk Fixture',
  'archive-bulk-fixture'
)
on conflict (id) do nothing;

insert into public.tasks (
  id, project_id, board_id, title, status, position, author_id, task_type
)
select
  current_setting('test.task_a')::uuid,
  current_setting('test.project')::uuid,
  b.id,
  'Bulk A',
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
  current_setting('test.task_b')::uuid,
  current_setting('test.project')::uuid,
  b.id,
  'Bulk B',
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

select pg_temp.as_user(current_setting('test.viewer')::uuid);

select throws_ok(
  format(
    'select public.archive_tasks(array[%L, %L]::uuid[])',
    current_setting('test.task_a'),
    current_setting('test.task_b')
  ),
  '42501',
  'Only managers can archive tasks',
  'viewer cannot bulk-archive'
);

select pg_temp.as_user(current_setting('test.owner')::uuid);

select is(
  public.archive_tasks(
    array[
      current_setting('test.task_a')::uuid,
      current_setting('test.task_b')::uuid
    ]
  ),
  2,
  'owner bulk-archives two active tasks'
);

select ok(
  (
    select count(*)::integer
    from public.tasks as t
    where t.id in (
      current_setting('test.task_a')::uuid,
      current_setting('test.task_b')::uuid
    )
      and t.archived_at is not null
  ) = 2,
  'both tasks have archived_at set'
);

select is(
  (
    select count(*)::integer
    from public.activity_log as a
    where a.task_id in (
      current_setting('test.task_a')::uuid,
      current_setting('test.task_b')::uuid
    )
      and a.action = 'updated'
  ),
  2,
  'activity rows written for archived tasks'
);

select is(
  public.archive_tasks(
    array[
      current_setting('test.task_a')::uuid,
      current_setting('test.task_b')::uuid
    ]
  ),
  0,
  're-archive of already archived returns 0'
);

select * from finish();
rollback;
