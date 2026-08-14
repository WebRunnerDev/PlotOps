-- Contributor+ can add/remove relates to; Viewer can read; domain legality on RPC.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

select set_config('test.owner', 'f1111111-1111-1111-1111-111111111111', true);
select set_config('test.contributor', 'f2222222-2222-2222-2222-222222222222', true);
select set_config('test.viewer', 'f3333333-3333-3333-3333-333333333333', true);
select set_config('test.team', 'f4444444-4444-4444-4444-444444444444', true);
select set_config('test.project', 'f5555555-5555-5555-5555-555555555555', true);
select set_config('test.other_project', 'f5555555-5555-5555-5555-555555555556', true);
select set_config('test.parent', 'f6666666-6666-6666-6666-666666666661', true);
select set_config('test.child', 'f6666666-6666-6666-6666-666666666662', true);
select set_config('test.peer', 'f6666666-6666-6666-6666-666666666663', true);
select set_config('test.other_board_task', 'f6666666-6666-6666-6666-666666666664', true);
select set_config('test.foreign', 'f6666666-6666-6666-6666-666666666665', true);
select set_config('test.board2', 'f7777777-7777-7777-7777-777777777771', true);

set local role postgres;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    current_setting('test.owner')::uuid,
    'authenticated', 'authenticated',
    'link-owner@test.com',
    crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, now(), now()
  ),
  (
    current_setting('test.contributor')::uuid,
    'authenticated', 'authenticated',
    'link-contributor@test.com',
    crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, now(), now()
  ),
  (
    current_setting('test.viewer')::uuid,
    'authenticated', 'authenticated',
    'link-viewer@test.com',
    crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

insert into public.profiles (id, username)
values
  (current_setting('test.owner')::uuid, 'link-owner'),
  (current_setting('test.contributor')::uuid, 'link-contributor'),
  (current_setting('test.viewer')::uuid, 'link-viewer')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values (
  current_setting('test.team')::uuid,
  current_setting('test.owner')::uuid,
  'Task Link Fixture Team'
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
values
  (
    current_setting('test.project')::uuid,
    current_setting('test.team')::uuid,
    'Task Link Fixture',
    'task-link-fixture'
  ),
  (
    current_setting('test.other_project')::uuid,
    current_setting('test.team')::uuid,
    'Other Project',
    'task-link-other'
  )
on conflict (id) do nothing;

insert into public.boards (id, project_id, name, position)
values (
  current_setting('test.board2')::uuid,
  current_setting('test.project')::uuid,
  'Frontend',
  1
);

insert into public.board_columns (id, board_id, project_id, name, position)
values (
  'todo',
  current_setting('test.board2')::uuid,
  current_setting('test.project')::uuid,
  'To Do',
  0
);

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
  and b.id <> current_setting('test.board2')::uuid
limit 1;

insert into public.tasks (
  id, project_id, board_id, title, status, position, author_id, task_type,
  parent_id
)
select
  current_setting('test.child')::uuid,
  current_setting('test.project')::uuid,
  t.board_id,
  'Child Task',
  'todo',
  1,
  current_setting('test.owner')::uuid,
  'task',
  t.id
from public.tasks as t
where t.id = current_setting('test.parent')::uuid;

insert into public.tasks (
  id, project_id, board_id, title, status, position, author_id, task_type
)
select
  current_setting('test.peer')::uuid,
  current_setting('test.project')::uuid,
  t.board_id,
  'Peer Task',
  'todo',
  2,
  current_setting('test.owner')::uuid,
  'task'
from public.tasks as t
where t.id = current_setting('test.parent')::uuid;

insert into public.tasks (
  id, project_id, board_id, title, status, position, author_id, task_type
)
values (
  current_setting('test.other_board_task')::uuid,
  current_setting('test.project')::uuid,
  current_setting('test.board2')::uuid,
  'Other Board Task',
  'todo',
  0,
  current_setting('test.owner')::uuid,
  'task'
);

insert into public.tasks (
  id, project_id, board_id, title, status, position, author_id, task_type
)
select
  current_setting('test.foreign')::uuid,
  current_setting('test.other_project')::uuid,
  b.id,
  'Foreign Task',
  'todo',
  0,
  current_setting('test.owner')::uuid,
  'task'
from public.boards as b
where b.project_id = current_setting('test.other_project')::uuid
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
    'select public.create_task_link(%L::uuid, %L::uuid, %L)',
    current_setting('test.parent'),
    current_setting('test.peer'),
    'relates_to'
  ),
  '42501',
  'Only editors can create a Task Link',
  'Viewer cannot create a relates to Task Link'
);

select pg_temp.as_user(current_setting('test.contributor')::uuid);
select throws_ok(
  format(
    'select public.create_task_link(%L::uuid, %L::uuid, %L)',
    current_setting('test.parent'),
    current_setting('test.parent'),
    'relates_to'
  ),
  'P0001',
  'A Task cannot relate to itself',
  'Self-link is rejected on the server'
);

select throws_ok(
  format(
    'select public.create_task_link(%L::uuid, %L::uuid, %L)',
    current_setting('test.parent'),
    current_setting('test.child'),
    'relates_to'
  ),
  'P0001',
  'A Task Link cannot connect a Parent Task and its own Subtask',
  'Parent↔Subtask link is rejected on the server'
);

select throws_ok(
  format(
    'select public.create_task_link(%L::uuid, %L::uuid, %L)',
    current_setting('test.parent'),
    current_setting('test.foreign'),
    'relates_to'
  ),
  'P0001',
  'Task Links must stay inside the same Project',
  'Links across Projects are rejected'
);

select lives_ok(
  format(
    'select public.create_task_link(%L::uuid, %L::uuid, %L)',
    current_setting('test.parent'),
    current_setting('test.other_board_task'),
    'relates_to'
  ),
  'Links across Boards in the same Project work'
);

select lives_ok(
  format(
    'select public.create_task_link(%L::uuid, %L::uuid, %L)',
    current_setting('test.parent'),
    current_setting('test.peer'),
    'relates_to'
  ),
  'Contributor can create a relates to Task Link'
);

select throws_ok(
  format(
    'select public.create_task_link(%L::uuid, %L::uuid, %L)',
    current_setting('test.peer'),
    current_setting('test.parent'),
    'relates_to'
  ),
  'P0001',
  'These Tasks are already linked',
  'Duplicate undirected relates to is rejected'
);

select ok(
  exists (
    select 1
    from public.activity_log as a
    join public.tasks as peer
      on peer.id = current_setting('test.peer')::uuid
    where a.task_id = current_setting('test.parent')::uuid
      and a.metadata @> jsonb_build_object(
        'changes',
        jsonb_build_array(
          jsonb_build_object(
            'field', 'task_link',
            'from', null,
            'to', jsonb_build_object('key', peer.task_key, 'kind', 'relates_to')
          )
        )
      )
  )
  and exists (
    select 1
    from public.activity_log as a
    join public.tasks as parent
      on parent.id = current_setting('test.parent')::uuid
    where a.task_id = current_setting('test.peer')::uuid
      and a.metadata @> jsonb_build_object(
        'changes',
        jsonb_build_array(
          jsonb_build_object(
            'field', 'task_link',
            'from', null,
            'to', jsonb_build_object('key', parent.task_key, 'kind', 'relates_to')
          )
        )
      )
  ),
  'Activity records add on both Tasks'
);

select is(
  (
    select count(*)::integer
    from public.notifications as n
    where n.task_id in (
      current_setting('test.parent')::uuid,
      current_setting('test.peer')::uuid,
      current_setting('test.other_board_task')::uuid
    )
  ),
  0,
  'No Notification for relates to add'
);

select pg_temp.as_user(current_setting('test.viewer')::uuid);
select is(
  (
    select count(*)::integer
    from public.task_links as link
    where link.project_id = current_setting('test.project')::uuid
  ),
  2,
  'Viewer can see Task Links in the Project'
);

select throws_ok(
  format(
    'select public.delete_task_link(%L::uuid)',
    (
      select link.id::text
      from public.task_links as link
      where link.source_task_id = current_setting('test.parent')::uuid
        and link.target_task_id = current_setting('test.peer')::uuid
    )
  ),
  '42501',
  'Only editors can remove a Task Link',
  'Viewer cannot remove a Task Link'
);

select pg_temp.as_user(current_setting('test.contributor')::uuid);
select lives_ok(
  format(
    'select public.delete_task_link(%L::uuid)',
    (
      select link.id::text
      from public.task_links as link
      where link.source_task_id = current_setting('test.parent')::uuid
        and link.target_task_id = current_setting('test.peer')::uuid
    )
  ),
  'Contributor can remove a relates to Task Link'
);

select is(
  (
    select count(*)::integer
    from public.activity_log as a
    where a.task_id in (
      current_setting('test.parent')::uuid,
      current_setting('test.peer')::uuid
    )
      and a.metadata @> '{"changes":[{"field":"task_link","to":null}]}'::jsonb
  ),
  2,
  'Activity records remove on both Tasks'
);

select is(
  (
    select count(*)::integer
    from public.notifications as n
    where n.task_id in (
      current_setting('test.parent')::uuid,
      current_setting('test.peer')::uuid
    )
  ),
  0,
  'No Notification for relates to remove'
);

select * from finish();
rollback;
