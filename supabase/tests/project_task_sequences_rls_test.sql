-- Sequence rows are trigger-owned: Contributors cannot write next_val, but
-- task / subtask insert still allocates task_key via trg_set_task_key.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

select set_config('test.owner', 'e1111111-1111-1111-1111-111111111111', true);
select set_config('test.contributor', 'e2222222-2222-2222-2222-222222222222', true);
select set_config('test.team', 'e4444444-4444-4444-4444-444444444444', true);
select set_config('test.project', 'e5555555-5555-5555-5555-555555555555', true);
select set_config('test.parent', 'e6666666-6666-6666-6666-666666666661', true);

set local role postgres;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    current_setting('test.owner')::uuid,
    'authenticated', 'authenticated',
    'pts-owner@test.com',
    crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, now(), now()
  ),
  (
    current_setting('test.contributor')::uuid,
    'authenticated', 'authenticated',
    'pts-contributor@test.com',
    crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

insert into public.profiles (id, username)
values
  (current_setting('test.owner')::uuid, 'pts-owner'),
  (current_setting('test.contributor')::uuid, 'pts-contributor')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values (
  current_setting('test.team')::uuid,
  current_setting('test.owner')::uuid,
  'PTS Fixture Team'
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
  'PTS Fixture',
  'pts-fixture'
)
on conflict (id) do nothing;

insert into public.tasks (
  id, project_id, board_id, title, status, position, author_id, task_type
)
select
  current_setting('test.parent')::uuid,
  current_setting('test.project')::uuid,
  b.id,
  'PTS Parent',
  'todo',
  0,
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

select ok(
  not has_table_privilege('authenticated', 'public.project_task_sequences', 'SELECT'),
  'authenticated cannot SELECT project_task_sequences'
);
select ok(
  not has_table_privilege('authenticated', 'public.project_task_sequences', 'INSERT'),
  'authenticated cannot INSERT project_task_sequences'
);
select ok(
  not has_table_privilege('authenticated', 'public.project_task_sequences', 'UPDATE'),
  'authenticated cannot UPDATE project_task_sequences'
);
select ok(
  not has_table_privilege('authenticated', 'public.project_task_sequences', 'DELETE'),
  'authenticated cannot DELETE project_task_sequences'
);

select pg_temp.as_user(current_setting('test.contributor')::uuid);

select throws_ok(
  format(
    'update public.project_task_sequences set next_val = 999999 where project_id = %L::uuid',
    current_setting('test.project')
  ),
  '42501',
  null,
  'Contributor cannot update next_val'
);

select throws_ok(
  format(
    'insert into public.project_task_sequences (project_id, next_val) values (%L::uuid, 42)',
    current_setting('test.project')
  ),
  '42501',
  null,
  'Contributor cannot insert a sequence row'
);

select lives_ok(
  format(
    'select public.create_subtask(%L::uuid, %L)',
    current_setting('test.parent'),
    'PTS child'
  ),
  'Contributor subtask insert still allocates task_key via trigger'
);

select isnt(
  (
    select t.task_key
    from public.tasks as t
    where t.title = 'PTS child'
  ),
  null,
  'Subtask created by Contributor has a task_key'
);

select pg_temp.as_user(current_setting('test.owner')::uuid);
select lives_ok(
  format(
    $$insert into public.tasks (project_id, board_id, title, status, position, task_type)
      select %L::uuid, b.id, 'PTS root', 'todo', 1, 'task'
      from public.boards as b
      where b.project_id = %L::uuid
      limit 1$$,
    current_setting('test.project'),
    current_setting('test.project')
  ),
  'Manager root insert still allocates task_key via trigger'
);

select * from finish();
rollback;
