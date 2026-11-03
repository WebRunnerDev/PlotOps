-- create_task / change_task_status / add_task_comment / MCP log + task column lock
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

select set_config('test.owner', 'a1111111-1111-1111-1111-111111111111', true);
select set_config('test.manager', 'a2222222-2222-2222-2222-222222222222', true);
select set_config('test.contributor', 'a3333333-3333-3333-3333-333333333333', true);
select set_config('test.viewer', 'a4444444-4444-4444-4444-444444444444', true);
select set_config('test.outsider', 'a5555555-5555-5555-5555-555555555555', true);
select set_config('test.team', 'a6666666-6666-6666-6666-666666666666', true);
select set_config('test.project', 'a7777777-7777-7777-7777-777777777777', true);

set local role postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  (current_setting('test.owner')::uuid, 'authenticated', 'authenticated', 'owner-mcp@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.manager')::uuid, 'authenticated', 'authenticated', 'manager-mcp@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.contributor')::uuid, 'authenticated', 'authenticated', 'contributor-mcp@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.viewer')::uuid, 'authenticated', 'authenticated', 'viewer-mcp@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.outsider')::uuid, 'authenticated', 'authenticated', 'outsider-mcp@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, username)
values
  (current_setting('test.owner')::uuid, 'owner-mcp'),
  (current_setting('test.manager')::uuid, 'manager-mcp'),
  (current_setting('test.contributor')::uuid, 'contributor-mcp'),
  (current_setting('test.viewer')::uuid, 'viewer-mcp'),
  (current_setting('test.outsider')::uuid, 'outsider-mcp')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values (current_setting('test.team')::uuid, current_setting('test.owner')::uuid, 'Mcp Team')
on conflict (id) do nothing;

insert into public.team_members (team_id, user_id, role)
values
  (current_setting('test.team')::uuid, current_setting('test.manager')::uuid, 'manager'),
  (current_setting('test.team')::uuid, current_setting('test.contributor')::uuid, 'contributor'),
  (current_setting('test.team')::uuid, current_setting('test.viewer')::uuid, 'viewer')
on conflict do nothing;

insert into public.projects (id, team_id, name, slug)
values (
  current_setting('test.project')::uuid,
  current_setting('test.team')::uuid,
  'Mcp Repo',
  'mcp-repo-rpcs'
)
on conflict (id) do nothing;

select set_config(
  'test.board',
  (
    select b.id::text
    from public.boards as b
    where b.project_id = current_setting('test.project')::uuid
    order by b.position
    limit 1
  ),
  true
);

update public.boards
set default_task_type = 'bug',
    auto_assign_to_creator = false
where id = current_setting('test.board')::uuid;

create or replace function pg_temp.as_user(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

select pg_temp.as_user(current_setting('test.viewer')::uuid);
select throws_ok(
  format(
    $$select public.create_task(%L::uuid, 'Nope', '{}'::jsonb)$$,
    current_setting('test.board')
  ),
  '42501',
  'Only managers can create tasks',
  'Viewer cannot create_task'
);

select pg_temp.as_user(current_setting('test.contributor')::uuid);
select throws_ok(
  format(
    $$select public.create_task(%L::uuid, 'Nope', '{}'::jsonb)$$,
    current_setting('test.board')
  ),
  '42501',
  'Only managers can create tasks',
  'Contributor cannot create_task'
);

select pg_temp.as_user(current_setting('test.manager')::uuid);
select lives_ok(
  format(
    $$select set_config(
      'test.task_a',
      public.create_task(%L::uuid, '  First card  ', '{}'::jsonb)::text,
      true
    )$$,
    current_setting('test.board')
  ),
  'Manager can create_task'
);

select is(
  (select task_type from public.tasks where id = current_setting('test.task_a')::uuid),
  'bug'::public.task_type,
  'create_task uses board default_task_type'
);

select is(
  (select status from public.tasks where id = current_setting('test.task_a')::uuid),
  'todo',
  'create_task defaults to the first column'
);

select is(
  (select author_id from public.tasks where id = current_setting('test.task_a')::uuid),
  current_setting('test.manager')::uuid,
  'create_task author is the caller'
);

select is(
  (select title from public.tasks where id = current_setting('test.task_a')::uuid),
  'First card',
  'create_task trims the title'
);

select is(
  (select position from public.tasks where id = current_setting('test.task_a')::uuid),
  0,
  'first create_task position is 0'
);

select lives_ok(
  format(
    $$select set_config(
      'test.task_b',
      public.create_task(
        %L::uuid,
        'Second',
        jsonb_build_object('status', 'todo', 'task_type', 'task', 'priority', 'high')
      )::text,
      true
    )$$,
    current_setting('test.board')
  ),
  'Manager can create a second task'
);

select is(
  (select position from public.tasks where id = current_setting('test.task_b')::uuid),
  1,
  'second create_task appends in the column'
);

select pg_temp.as_user(current_setting('test.outsider')::uuid);
select throws_ok(
  format(
    $$select public.create_task(%L::uuid, 'Steal', '{}'::jsonb)$$,
    current_setting('test.board')
  ),
  '42501',
  'Only managers can create tasks',
  'Outsider cannot create_task'
);

select pg_temp.as_user(current_setting('test.contributor')::uuid);
select lives_ok(
  $$select public.change_task_status(current_setting('test.task_a')::uuid, 'in_progress')$$,
  'Contributor can change_task_status'
);

select is(
  (select status from public.tasks where id = current_setting('test.task_a')::uuid),
  'in_progress',
  'change_task_status updates the column'
);

select pg_temp.as_user(current_setting('test.viewer')::uuid);
select throws_ok(
  $$select public.change_task_status(current_setting('test.task_a')::uuid, 'done')$$,
  '42501',
  'Only editors can move tasks',
  'Viewer cannot change_task_status'
);

select pg_temp.as_user(current_setting('test.contributor')::uuid);
select lives_ok(
  $$select set_config(
    'test.comment_root',
    public.add_task_comment(
      current_setting('test.task_a')::uuid,
      'Looks good'
    )::text,
    true
  )$$,
  'Contributor can add_task_comment'
);

select is(
  (select author_id from public.task_comments where id = current_setting('test.comment_root')::uuid),
  current_setting('test.contributor')::uuid,
  'add_task_comment author is the caller'
);

select lives_ok(
  $$select public.add_task_comment(
    current_setting('test.task_a')::uuid,
    'Reply',
    current_setting('test.comment_root')::uuid
  )$$,
  'Contributor can reply with parent_id'
);

select pg_temp.as_user(current_setting('test.viewer')::uuid);
select throws_ok(
  $$select public.add_task_comment(current_setting('test.task_a')::uuid, 'Nope')$$,
  '42501',
  'Only editors can comment on tasks',
  'Viewer cannot add_task_comment'
);

select pg_temp.as_user(current_setting('test.contributor')::uuid);
select throws_ok(
  $$update public.tasks
    set task_key = 'HACK-1'
    where id = current_setting('test.task_a')::uuid$$,
  '42501',
  'System task columns cannot be updated',
  'task_key cannot be updated'
);

select throws_ok(
  $$update public.tasks
    set project_id = '99999999-9999-9999-9999-999999999999'
    where id = current_setting('test.task_a')::uuid$$,
  '42501',
  'System task columns cannot be updated',
  'project_id cannot be updated'
);

select lives_ok(
  $$update public.tasks
    set title = 'Renamed'
    where id = current_setting('test.task_a')::uuid$$,
  'title remains updatable for editors'
);

select pg_temp.as_user(current_setting('test.manager')::uuid);
select lives_ok(
  $$select public.log_mcp_action('list_projects', true, null, null, null, null)$$,
  'Manager can log_mcp_action'
);

select is(
  public.claim_mcp_rate_limit(100, 60),
  true,
  'claim_mcp_rate_limit allows under the cap'
);

select pg_temp.as_user(current_setting('test.outsider')::uuid);
select is(
  (select count(*)::integer from public.mcp_action_log),
  0,
  'Outsider cannot read another user MCP action log'
);

select * from finish();
rollback;
