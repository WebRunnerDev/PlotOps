-- Epics (ADR 0031): Manager+ creates/converts; epic_id is root-only, same Project,
-- Epic-typed target; Epics have no Parent, Subtasks, Sprint or Estimate.
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

select set_config('test.owner', 'e1111111-1111-1111-1111-111111111111', true);
select set_config('test.contributor', 'e2222222-2222-2222-2222-222222222222', true);
select set_config('test.team', 'e4444444-4444-4444-4444-444444444444', true);
select set_config('test.project', 'e5555555-5555-5555-5555-555555555555', true);
select set_config('test.epic', 'e6666666-6666-6666-6666-666666666661', true);
select set_config('test.story', 'e6666666-6666-6666-6666-666666666662', true);
select set_config('test.plain', 'e6666666-6666-6666-6666-666666666663', true);
select set_config('test.parent', 'e6666666-6666-6666-6666-666666666664', true);

set local role postgres;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    current_setting('test.owner')::uuid,
    'authenticated', 'authenticated',
    'epic-owner@test.com',
    crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, now(), now()
  ),
  (
    current_setting('test.contributor')::uuid,
    'authenticated', 'authenticated',
    'epic-contributor@test.com',
    crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

insert into public.profiles (id, username)
values
  (current_setting('test.owner')::uuid, 'epic-owner'),
  (current_setting('test.contributor')::uuid, 'epic-contributor')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values (
  current_setting('test.team')::uuid,
  current_setting('test.owner')::uuid,
  'Epic Fixture Team'
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
  'Epic Fixture',
  'epic-fixture'
)
on conflict (id) do nothing;

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

create or replace function pg_temp.insert_root(
  p_id uuid,
  p_title text,
  p_type public.task_type,
  p_position integer
)
returns void
language sql
as $$
  insert into public.tasks (
    id, project_id, board_id, title, status, position, author_id, task_type
  )
  select
    p_id,
    current_setting('test.project')::uuid,
    b.id,
    p_title,
    'todo',
    p_position,
    current_setting('test.owner')::uuid,
    p_type
  from public.boards as b
  where b.project_id = current_setting('test.project')::uuid
  limit 1;
$$;

select pg_temp.as_user(current_setting('test.owner')::uuid);

select lives_ok(
  format(
    'select pg_temp.insert_root(%L::uuid, %L, %L, 0)',
    current_setting('test.epic'), 'Checkout revamp', 'epic'
  ),
  'Manager can create an Epic'
);

select pg_temp.insert_root(current_setting('test.story')::uuid, 'Pay by card', 'story', 1);
select pg_temp.insert_root(current_setting('test.plain')::uuid, 'Plain task', 'task', 2);
select pg_temp.insert_root(current_setting('test.parent')::uuid, 'Parent task', 'task', 3);

select matches(
  (select t.task_key from public.tasks as t where t.id = current_setting('test.epic')::uuid),
  '^EPIC-\d+$',
  'Epic keys use the EPIC prefix'
);

select matches(
  (select t.task_key from public.tasks as t where t.id = current_setting('test.story')::uuid),
  '^STORY-\d+$',
  'Story keys use the STORY prefix'
);

select lives_ok(
  format(
    'update public.tasks set epic_id = %L::uuid where id = %L::uuid',
    current_setting('test.epic'), current_setting('test.story')
  ),
  'A Story can join an Epic'
);

select throws_ok(
  format(
    'update public.tasks set epic_id = %L::uuid where id = %L::uuid',
    current_setting('test.plain'), current_setting('test.parent')
  ),
  'P0001',
  'Target Task is not an Epic',
  'epic_id must point at an Epic'
);

select throws_ok(
  format(
    'select public.create_subtask(%L::uuid, %L)',
    current_setting('test.epic'), 'Nope'
  ),
  'P0001',
  'An Epic cannot have Subtasks',
  'Epics cannot have Subtasks'
);

select throws_ok(
  format(
    'update public.tasks set task_type = %L where id = %L::uuid',
    'task', current_setting('test.epic')
  ),
  'P0001',
  'An Epic with Tasks cannot change type',
  'An Epic keeps its type while it has Tasks'
);

-- Epic has no Estimate: silently dropped on write.
update public.tasks
set estimate = 5
where id = current_setting('test.epic')::uuid;

select is(
  (select t.estimate from public.tasks as t where t.id = current_setting('test.epic')::uuid),
  null,
  'Epics never store an Estimate'
);

-- Subtask of a Task in an Epic: Epic comes from the Parent, not epic_id.
select public.create_subtask(current_setting('test.parent')::uuid, 'Child');

select throws_ok(
  format(
    'update public.tasks set epic_id = %L::uuid where parent_id = %L::uuid',
    current_setting('test.epic'), current_setting('test.parent')
  ),
  'P0001',
  'A Subtask belongs to its Parent Task''s Epic',
  'Subtasks cannot set epic_id'
);

select throws_ok(
  format(
    'update public.tasks set task_type = %L where id = %L::uuid',
    'epic', current_setting('test.parent')
  ),
  'P0001',
  'A Parent Task cannot become an Epic',
  'A Parent Task cannot become an Epic'
);

-- Becoming a Subtask drops the Task's own Epic membership.
select public.set_task_parent(
  current_setting('test.story')::uuid,
  current_setting('test.parent')::uuid
);

select is(
  (select t.epic_id from public.tasks as t where t.id = current_setting('test.story')::uuid),
  null,
  'Linking as a Subtask clears epic_id'
);

select public.clear_task_parent(current_setting('test.story')::uuid);
update public.tasks
set epic_id = current_setting('test.epic')::uuid
where id = current_setting('test.story')::uuid;

select is(
  (
    select e.task_count
    from public.project_epics(current_setting('test.project')::uuid) as e
    where e.id = current_setting('test.epic')::uuid
  ),
  1,
  'project_epics counts the Epic''s Tasks'
);

select throws_ok(
  format(
    'update public.boards set default_task_type = %L where project_id = %L::uuid',
    'epic', current_setting('test.project')
  ),
  '23514',
  null,
  'A Board cannot default to Epic'
);

-- Contributor cannot convert to / from Epic.
select pg_temp.as_user(current_setting('test.contributor')::uuid);

select throws_ok(
  format(
    'update public.tasks set task_type = %L where id = %L::uuid',
    'epic', current_setting('test.plain')
  ),
  '42501',
  'Only managers can create or convert Epics',
  'Contributor cannot convert a Task into an Epic'
);

select lives_ok(
  format(
    'update public.tasks set epic_id = %L::uuid where id = %L::uuid',
    current_setting('test.epic'), current_setting('test.plain')
  ),
  'Contributor can add a Task to an Epic'
);

-- Deleting the Epic releases its Tasks.
select pg_temp.as_user(current_setting('test.owner')::uuid);

update public.tasks
set archived_at = now()
where id = current_setting('test.epic')::uuid;

select lives_ok(
  format(
    'delete from public.tasks where id = %L::uuid',
    current_setting('test.epic')
  ),
  'Manager can delete an archived Epic'
);

select is(
  (
    select count(*)::integer
    from public.tasks as t
    where t.epic_id = current_setting('test.epic')::uuid
  ),
  0,
  'Deleting an Epic clears epic_id on its Tasks'
);

select * from finish();
rollback;
