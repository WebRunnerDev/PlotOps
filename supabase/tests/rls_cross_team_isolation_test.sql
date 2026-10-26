-- RLS audit (#280): catalog invariants + a member of Team B can neither read
-- nor change Team A data (tables and task-media storage).
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

select set_config('test.user_a', 'f1111111-1111-1111-1111-111111111111', true);
select set_config('test.user_b', 'f2222222-2222-2222-2222-222222222222', true);
select set_config('test.team_a', 'f3333333-3333-3333-3333-333333333331', true);
select set_config('test.team_b', 'f3333333-3333-3333-3333-333333333332', true);
select set_config('test.project_a', 'f4444444-4444-4444-4444-444444444441', true);
select set_config('test.project_b', 'f4444444-4444-4444-4444-444444444442', true);
select set_config('test.task_a', 'f5555555-5555-5555-5555-555555555551', true);
select set_config('test.task_b', 'f5555555-5555-5555-5555-555555555552', true);

set local role postgres;

-- ---------------------------------------------------------------------------
-- Catalog invariants
-- ---------------------------------------------------------------------------

select is_empty(
  $$
    select c.relname
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  $$,
  'every public table has RLS enabled'
);

select is_empty(
  $$
    select tablename || '.' || policyname
    from pg_policies
    where schemaname in ('public', 'storage')
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and (
        coalesce(btrim(qual), '') = 'true'
        or coalesce(btrim(with_check), '') = 'true'
      )
  $$,
  'no write policy is unconditionally true'
);

select is_empty(
  $$
    select tablename || '.' || policyname
    from pg_policies
    where schemaname = 'public'
      and roles && array['anon', 'public']::name[]
  $$,
  'no public-schema policy targets anon or PUBLIC'
);

select is_empty(
  $$
    select grantee || ':' || table_name || ':' || privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')
  $$,
  'client roles hold no TRUNCATE / TRIGGER / REFERENCES on public tables'
);

select is_empty(
  $$
    select table_name || ':' || privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'anon'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  $$,
  'anon holds no write privilege on public tables'
);

select is(
  (select public from storage.buckets where id = 'task-media'),
  true,
  'task-media stays a public bucket (embedded image URLs)'
);

-- ---------------------------------------------------------------------------
-- Fixture: user A owns Team A (Project A, Task A); user B owns Team B.
-- ---------------------------------------------------------------------------

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    current_setting('test.user_a')::uuid, 'authenticated', 'authenticated',
    'rls-iso-a@test.com', crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    current_setting('test.user_b')::uuid, 'authenticated', 'authenticated',
    'rls-iso-b@test.com', crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

insert into public.profiles (id, username)
values
  (current_setting('test.user_a')::uuid, 'rls-iso-a'),
  (current_setting('test.user_b')::uuid, 'rls-iso-b')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values
  (current_setting('test.team_a')::uuid, current_setting('test.user_a')::uuid, 'RLS Iso A'),
  (current_setting('test.team_b')::uuid, current_setting('test.user_b')::uuid, 'RLS Iso B');

insert into public.projects (id, team_id, name, slug)
values
  (current_setting('test.project_a')::uuid, current_setting('test.team_a')::uuid, 'RLS Iso A', 'rls-iso-a'),
  (current_setting('test.project_b')::uuid, current_setting('test.team_b')::uuid, 'RLS Iso B', 'rls-iso-b');

insert into public.tasks (
  id, project_id, board_id, title, status, position, author_id, task_type
)
select
  v.task_id, v.project_id, b.id, 'Iso task', 'todo', 0, v.author_id, 'task'
from (
  values
    (current_setting('test.task_a')::uuid, current_setting('test.project_a')::uuid, current_setting('test.user_a')::uuid),
    (current_setting('test.task_b')::uuid, current_setting('test.project_b')::uuid, current_setting('test.user_b')::uuid)
) as v (task_id, project_id, author_id)
join lateral (
  select id from public.boards where project_id = v.project_id limit 1
) as b on true;

select set_config(
  'test.board_a',
  (select id::text from public.boards where project_id = current_setting('test.project_a')::uuid limit 1),
  true
);

insert into public.task_comments (task_id, project_id, author_id, body)
values (
  current_setting('test.task_a')::uuid,
  current_setting('test.project_a')::uuid,
  current_setting('test.user_a')::uuid,
  'secret'
);

insert into public.labels (project_id, name, color)
values (current_setting('test.project_a')::uuid, 'iso-label', '#ff0000');

insert into storage.objects (bucket_id, name, owner)
values (
  'task-media',
  current_setting('test.user_a') || '/' || current_setting('test.task_a') || '/a.png',
  current_setting('test.user_a')::uuid
);

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

-- ---------------------------------------------------------------------------
-- User B: reads of Team A data return nothing
-- ---------------------------------------------------------------------------

select pg_temp.as_user(current_setting('test.user_b')::uuid);

select is_empty(
  format('select 1 from public.teams where id = %L', current_setting('test.team_a')),
  'B cannot see Team A'
);
select is_empty(
  format('select 1 from public.team_members where team_id = %L', current_setting('test.team_a')),
  'B cannot see Team A members'
);
select is_empty(
  format('select 1 from public.projects where id = %L', current_setting('test.project_a')),
  'B cannot see Project A'
);
select is_empty(
  format('select 1 from public.boards where project_id = %L', current_setting('test.project_a')),
  'B cannot see Project A boards'
);
select is_empty(
  format('select 1 from public.board_columns where project_id = %L', current_setting('test.project_a')),
  'B cannot see Project A columns'
);
select is_empty(
  format('select 1 from public.tasks where project_id = %L', current_setting('test.project_a')),
  'B cannot see Project A tasks'
);
select is_empty(
  format('select 1 from public.task_comments where project_id = %L', current_setting('test.project_a')),
  'B cannot see Project A comments'
);
select is_empty(
  format('select 1 from public.labels where project_id = %L', current_setting('test.project_a')),
  'B cannot see Project A labels'
);
select is_empty(
  format('select 1 from public.activity_log where project_id = %L', current_setting('test.project_a')),
  'B cannot see Project A activity'
);
select is_empty(
  format('select 1 from public.profiles where id = %L', current_setting('test.user_a')),
  'B cannot see the profile of a user it shares no Team with'
);
select is_empty(
  format(
    $$select 1 from storage.objects where bucket_id = 'task-media' and name like %L$$,
    current_setting('test.user_a') || '/%'
  ),
  'B cannot list Task A media'
);

-- ---------------------------------------------------------------------------
-- User B: writes against Team A data are rejected or affect nothing
-- ---------------------------------------------------------------------------

update public.tasks set title = 'pwned'
where id = current_setting('test.task_a')::uuid;
update public.projects set name = 'pwned'
where id = current_setting('test.project_a')::uuid;
update public.teams set name = 'pwned'
where id = current_setting('test.team_a')::uuid;
delete from public.task_comments
where project_id = current_setting('test.project_a')::uuid;
delete from public.tasks
where id = current_setting('test.task_a')::uuid;
delete from public.projects
where id = current_setting('test.project_a')::uuid;

select throws_ok(
  format(
    -- project_id is synced from board_id by trigger, so aim at Project A's
    -- board; the invoker-rights trigger cannot see it under B's RLS.
    $$insert into public.tasks (project_id, board_id, title, status, position, author_id, task_type)
      values (%L, %L, 'x', 'todo', 1, %L, 'task')$$,
    current_setting('test.project_a'),
    current_setting('test.board_a'),
    current_setting('test.user_b')
  ),
  'P0001',
  'tasks.board_id must reference an existing board',
  'B cannot insert a task into Project A'
);

select throws_ok(
  format(
    $$insert into public.team_members (team_id, user_id, role) values (%L, %L, 'admin')$$,
    current_setting('test.team_a'),
    current_setting('test.user_b')
  ),
  '42501',
  null,
  'B cannot add itself to Team A'
);

select throws_ok(
  format(
    $$insert into public.task_comments (task_id, project_id, author_id, body) values (%L, %L, %L, 'x')$$,
    current_setting('test.task_a'),
    current_setting('test.project_a'),
    current_setting('test.user_b')
  ),
  '42501',
  null,
  'B cannot comment on Task A'
);

select throws_ok(
  format(
    $$insert into storage.objects (bucket_id, name, owner) values ('task-media', %L, %L)$$,
    current_setting('test.user_b') || '/' || current_setting('test.task_a') || '/b.png',
    current_setting('test.user_b')
  ),
  '42501',
  null,
  'B cannot upload media under Task A'
);

select throws_ok(
  format(
    $$insert into storage.objects (bucket_id, name, owner) values ('task-media', %L, %L)$$,
    current_setting('test.user_b') || '/not-a-uuid/b.png',
    current_setting('test.user_b')
  ),
  '42501',
  null,
  'B cannot upload media outside a Task folder'
);

select lives_ok(
  format(
    $$insert into storage.objects (bucket_id, name, owner) values ('task-media', %L, %L)$$,
    current_setting('test.user_b') || '/' || current_setting('test.task_b') || '/b.png',
    current_setting('test.user_b')
  ),
  'B can upload media under its own Task'
);

-- ---------------------------------------------------------------------------
-- Team A data is intact
-- ---------------------------------------------------------------------------

set local role postgres;

select is(
  (select title from public.tasks where id = current_setting('test.task_a')::uuid),
  'Iso task',
  'Task A untouched by B'
);
select is(
  (select name from public.projects where id = current_setting('test.project_a')::uuid),
  'RLS Iso A',
  'Project A untouched by B'
);
select is(
  (select name from public.teams where id = current_setting('test.team_a')::uuid),
  'RLS Iso A',
  'Team A untouched by B'
);
select is(
  (select count(*)::integer from public.task_comments where project_id = current_setting('test.project_a')::uuid),
  1,
  'Project A comments untouched by B'
);

-- ---------------------------------------------------------------------------
-- Positive control: A still sees its own data
-- ---------------------------------------------------------------------------

select pg_temp.as_user(current_setting('test.user_a')::uuid);

select isnt_empty(
  format('select 1 from public.tasks where id = %L', current_setting('test.task_a')),
  'A sees Task A'
);
select isnt_empty(
  format(
    $$select 1 from storage.objects where bucket_id = 'task-media' and name like %L$$,
    current_setting('test.user_a') || '/%'
  ),
  'A lists Task A media'
);
select is_empty(
  format('select 1 from public.tasks where id = %L', current_setting('test.task_b')),
  'A cannot see Task B'
);

select * from finish();
rollback;
