-- Project Settings → Repositories (ADR 0035, #329): an Admin adds a
-- Repository → every Development Board gets its Base branch from the
-- Repository's default branch; Base branch is editable per Board ×
-- Repository; only Admin+ link and unlink; unlink drops Git links and writes
-- Task activity.
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

select set_config('test.owner', 'f5000000-0000-0000-0000-000000000001', true);
select set_config('test.admin', 'f5000000-0000-0000-0000-000000000002', true);
select set_config('test.manager', 'f5000000-0000-0000-0000-000000000003', true);
select set_config('test.team', 'f6000000-0000-0000-0000-000000000001', true);
select set_config('test.task', 'f7000000-0000-0000-0000-000000000001', true);

set local role postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  (current_setting('test.owner')::uuid, 'authenticated', 'authenticated', 'prs-owner@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.admin')::uuid, 'authenticated', 'authenticated', 'prs-admin@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.manager')::uuid, 'authenticated', 'authenticated', 'prs-manager@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, username)
values
  (current_setting('test.owner')::uuid, 'prs-owner'),
  (current_setting('test.admin')::uuid, 'prs-admin'),
  (current_setting('test.manager')::uuid, 'prs-manager')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values (current_setting('test.team')::uuid, current_setting('test.owner')::uuid, 'Repo Settings Team');

insert into public.team_members (team_id, user_id, role)
values
  (current_setting('test.team')::uuid, current_setting('test.admin')::uuid, 'admin'),
  (current_setting('test.team')::uuid, current_setting('test.manager')::uuid, 'manager');

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

-- One-Repository Project (Main = Development Board), plus a second
-- Development Board and a regular Board.
select pg_temp.as_user(current_setting('test.owner')::uuid);

select set_config(
  'test.project',
  public.create_project_with_repositories(
    current_setting('test.team')::uuid,
    'Settings',
    'settings',
    null,
    false,
    '[{"github_repo_id": 7001, "github_full_name": "o/web", "github_html_url": "https://github.com/o/web", "github_default_branch": "main"}]'::jsonb
  )::text,
  true
);

select set_config(
  'test.board_frontend',
  (public.create_board_with_columns(current_setting('test.project')::uuid, 'Frontend', null, true)).id::text,
  true
);
select set_config(
  'test.board_ops',
  (public.create_board_with_columns(current_setting('test.project')::uuid, 'Ops', null, false)).id::text,
  true
);

-- ---------------------------------------------------------------------------
-- Admin adds a Repository → every Development Board gets its Base branch
-- ---------------------------------------------------------------------------

select pg_temp.as_user(current_setting('test.admin')::uuid);

select lives_ok(
  $$insert into public.project_repositories (project_id, team_id, github_repo_id, github_full_name, github_html_url, github_default_branch)
    values (current_setting('test.project')::uuid, current_setting('test.team')::uuid, 7002, 'o/api', 'https://github.com/o/api', 'develop')$$,
  'an Admin links a Repository'
);

select results_eq(
  $$select b.name, br.base_branch
    from public.board_repositories br
    join public.boards b on b.id = br.board_id
    join public.project_repositories r on r.id = br.repository_id
    where r.github_repo_id = 7002
    order by b.name$$,
  $$values ('Frontend'::text, 'develop'::text), ('Main'::text, 'develop'::text)$$,
  'every Development Board gets the new Repository''s default branch as Base branch'
);

select is(
  (select count(*)::integer from public.board_repositories
   where board_id = current_setting('test.board_ops')::uuid),
  0,
  'a regular Board gets no Base branch'
);

select is(
  (select count(*)::integer from public.board_repositories br
   join public.project_repositories r on r.id = br.repository_id
   where r.github_repo_id = 7001 and br.base_branch = 'main'),
  2,
  'existing Repository keeps its own Base branch on both Development Boards'
);

-- ---------------------------------------------------------------------------
-- Base branch is per Board × Repository (Manager+ edits Boards)
-- ---------------------------------------------------------------------------

select pg_temp.as_user(current_setting('test.manager')::uuid);

update public.board_repositories as br
set base_branch = 'release'
from public.project_repositories as r
where r.id = br.repository_id
  and r.github_repo_id = 7002
  and br.board_id = current_setting('test.board_frontend')::uuid;

select results_eq(
  $$select b.name, r.github_full_name, br.base_branch
    from public.board_repositories br
    join public.boards b on b.id = br.board_id
    join public.project_repositories r on r.id = br.repository_id
    where br.project_id = current_setting('test.project')::uuid
    order by 1, 2$$,
  $$values
    ('Frontend'::text, 'o/api'::text, 'release'::text),
    ('Frontend'::text, 'o/web'::text, 'main'::text),
    ('Main'::text, 'o/api'::text, 'develop'::text),
    ('Main'::text, 'o/web'::text, 'main'::text)$$,
  'a Manager edits one Board × Repository Base branch without touching the others'
);

-- ---------------------------------------------------------------------------
-- Below Admin: no link, no unlink
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.project_repositories (project_id, team_id, github_repo_id, github_full_name, github_html_url)
    values (current_setting('test.project')::uuid, current_setting('test.team')::uuid, 7003, 'o/x', 'https://github.com/o/x')$$,
  '42501',
  null,
  'a Manager cannot link a Repository'
);

delete from public.project_repositories where github_repo_id = 7002;

select is(
  (select count(*)::integer from public.project_repositories
   where project_id = current_setting('test.project')::uuid),
  2,
  'a Manager cannot unlink a Repository'
);

-- ---------------------------------------------------------------------------
-- Admin unlinks: Git links on that Repository go, activity is written
-- ---------------------------------------------------------------------------

select pg_temp.as_user(current_setting('test.owner')::uuid);

insert into public.tasks (id, project_id, board_id, title, status, position)
values (
  current_setting('test.task')::uuid,
  current_setting('test.project')::uuid,
  current_setting('test.board_frontend')::uuid,
  'Full-stack Task',
  'todo',
  0
);

insert into public.task_git_links (task_id, repository_id, project_id, branch_name, pr_number, pr_url, pr_state)
select current_setting('test.task')::uuid, r.id, current_setting('test.project')::uuid,
  'feature/TASK-1', 3, 'https://github.com/' || r.github_full_name || '/pull/3', 'open'
from public.project_repositories as r
where r.project_id = current_setting('test.project')::uuid;

select pg_temp.as_user(current_setting('test.admin')::uuid);

select is(
  (select count(*)::integer from public.task_git_links l
   join public.project_repositories r on r.id = l.repository_id
   where r.github_repo_id = 7002),
  1,
  'Git link count for the Repository is visible before unlinking'
);

select lives_ok(
  $$delete from public.project_repositories where github_repo_id = 7002$$,
  'an Admin unlinks a Repository'
);

select is(
  (select count(*)::integer from public.project_repositories
   where project_id = current_setting('test.project')::uuid),
  1,
  'the Repository is gone'
);

select is(
  (select array_agg(r.github_full_name) from public.task_git_links l
   join public.project_repositories r on r.id = l.repository_id
   where l.task_id = current_setting('test.task')::uuid),
  array['o/web']::text[],
  'unlink removes only that Repository''s Git links'
);

select is(
  (select count(*)::integer from public.board_repositories
   where project_id = current_setting('test.project')::uuid),
  2,
  'unlink removes the Repository''s Base branches on every Board'
);

select is(
  (select count(*)::integer from public.activity_log
   where task_id = current_setting('test.task')::uuid
     and metadata ->> 'reason' = 'repository_unlinked'
     and metadata ->> 'repository' = 'o/api'
     and user_id = current_setting('test.admin')::uuid),
  1,
  'unlink writes Task activity attributed to the Admin'
);

select * from finish();
rollback;
