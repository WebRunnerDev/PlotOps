-- Multi-repo schema (ADR 0035): Repository cap, Git link uniqueness,
-- Board × Repository seeding, unlink cascade + activity, RLS writes.
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

select set_config('test.owner', 'f1000000-0000-0000-0000-000000000001', true);
select set_config('test.contributor', 'f1000000-0000-0000-0000-000000000002', true);
select set_config('test.team', 'f2000000-0000-0000-0000-000000000001', true);
select set_config('test.project', 'f3000000-0000-0000-0000-000000000001', true);
select set_config('test.task', 'f4000000-0000-0000-0000-000000000001', true);

set local role postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  (current_setting('test.owner')::uuid, 'authenticated', 'authenticated', 'mr-owner@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  (current_setting('test.contributor')::uuid, 'authenticated', 'authenticated', 'mr-contrib@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, username)
values
  (current_setting('test.owner')::uuid, 'mr-owner'),
  (current_setting('test.contributor')::uuid, 'mr-contrib')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values (current_setting('test.team')::uuid, current_setting('test.owner')::uuid, 'Multi-repo Team');

insert into public.team_members (team_id, user_id, role)
values (current_setting('test.team')::uuid, current_setting('test.contributor')::uuid, 'contributor');

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

-- ---------------------------------------------------------------------------
-- Create Project with two Repositories → Main board is a Development Board
-- with one Base branch row per Repository.
-- ---------------------------------------------------------------------------

select pg_temp.as_user(current_setting('test.owner')::uuid);

select set_config(
  'test.project',
  public.create_project_with_repositories(
    current_setting('test.team')::uuid,
    'Web + API',
    'web-api',
    null,
    false,
    '[
      {"github_repo_id": 5001, "github_full_name": "o/web", "github_html_url": "https://github.com/o/web", "github_default_branch": "main"},
      {"github_repo_id": 5002, "github_full_name": "o/api", "github_html_url": "https://github.com/o/api", "github_default_branch": "develop"}
    ]'::jsonb
  )::text,
  true
);

select is(
  (select count(*)::integer from public.project_repositories where project_id = current_setting('test.project')::uuid),
  2,
  'create_project_with_repositories stores both Repositories'
);

select is(
  (select is_development from public.boards where project_id = current_setting('test.project')::uuid and position = 0),
  true,
  'Main board becomes a Development Board when Repositories are given'
);

select results_eq(
  $$select r.github_full_name, br.base_branch
    from public.board_repositories br
    join public.project_repositories r on r.id = br.repository_id
    where br.project_id = current_setting('test.project')::uuid
    order by 1$$,
  $$values ('o/api'::text, 'develop'::text), ('o/web'::text, 'main'::text)$$,
  'Base branch is seeded per Board × Repository from each default branch'
);

select is(
  (select team_id from public.project_repositories where github_repo_id = 5001),
  current_setting('test.team')::uuid,
  'team_id is set from the Project'
);

-- ---------------------------------------------------------------------------
-- Repository cap = 5
-- ---------------------------------------------------------------------------

insert into public.project_repositories (project_id, team_id, github_repo_id, github_full_name, github_html_url)
select current_setting('test.project')::uuid, current_setting('test.team')::uuid, 5000 + n, 'o/r' || n, 'https://github.com/o/r' || n
from generate_series(3, 5) as n;

select is(
  (select count(*)::integer from public.project_repositories where project_id = current_setting('test.project')::uuid),
  5,
  'five Repositories fit under the cap'
);

select is(public.project_repositories_cap(), 5, 'Repository cap is 5');

select throws_ok(
  $$insert into public.project_repositories (project_id, team_id, github_repo_id, github_full_name, github_html_url)
    values (current_setting('test.project')::uuid, current_setting('test.team')::uuid, 5006, 'o/r6', 'https://github.com/o/r6')$$,
  'P0001',
  null,
  'a sixth Repository is rejected'
);

select is(
  (select count(*)::integer from public.board_repositories where project_id = current_setting('test.project')::uuid),
  5,
  'every added Repository joins the Development Board'
);

-- Trim back to two Repositories for the rest of the test (no Tasks yet, so
-- no unlink activity is written).
delete from public.project_repositories
where project_id = current_setting('test.project')::uuid
  and github_repo_id between 5003 and 5005;

-- ---------------------------------------------------------------------------
-- Git links
-- ---------------------------------------------------------------------------

insert into public.tasks (id, project_id, board_id, title, status, position)
select
  current_setting('test.task')::uuid,
  current_setting('test.project')::uuid,
  b.id,
  'Full-stack Task',
  'todo',
  0
from public.boards as b
where b.project_id = current_setting('test.project')::uuid and b.position = 0;

insert into public.task_git_links (task_id, repository_id, project_id, branch_name, pr_number, pr_url, pr_state)
select current_setting('test.task')::uuid, r.id, current_setting('test.project')::uuid,
  'feature/TASK-1-web', 12, 'https://github.com/o/web/pull/12', 'open'
from public.project_repositories as r where r.github_repo_id = 5001;

select lives_ok(
  $$insert into public.task_git_links (task_id, repository_id, project_id, branch_name, pr_number, pr_url, pr_state)
    select current_setting('test.task')::uuid, r.id, current_setting('test.project')::uuid,
      'feature/TASK-1-api', 12, 'https://github.com/o/api/pull/12', 'open'
    from public.project_repositories as r where r.github_repo_id = 5002$$,
  'a Task holds one Git link per Repository (same PR number in another Repository)'
);

select throws_ok(
  $$insert into public.task_git_links (task_id, repository_id, project_id, branch_name)
    select current_setting('test.task')::uuid, r.id, current_setting('test.project')::uuid, 'feature/TASK-1-web-2'
    from public.project_repositories as r where r.github_repo_id = 5001$$,
  '23505',
  null,
  'a second Git link to the same Repository is rejected'
);

select throws_ok(
  $$insert into public.task_git_links (task_id, repository_id, project_id)
    select current_setting('test.task')::uuid, r.id, current_setting('test.project')::uuid
    from public.project_repositories as r where r.github_repo_id = 5002$$,
  '23514',
  null,
  'an empty Git link is rejected'
);

-- update_task_details: repository_id is required with two Repositories
select throws_ok(
  $$select public.update_task_details(current_setting('test.task')::uuid, '{"branch_name": "x"}'::jsonb, null)$$,
  '22023',
  null,
  'update_task_details requires repository_id when the Project has several Repositories'
);

select lives_ok(
  format(
    $$select public.update_task_details(%L::uuid, %L::jsonb, null)$$,
    current_setting('test.task'),
    jsonb_build_object(
      'repository_id', (select id from public.project_repositories where github_repo_id = 5002),
      'pr_state', 'merged'
    )
  ),
  'update_task_details patches the Git link of the given Repository'
);

select is(
  (select l.pr_state from public.task_git_links l
   join public.project_repositories r on r.id = l.repository_id
   where r.github_repo_id = 5002),
  'merged',
  'pr_state updated on the right Git link only'
);

-- ---------------------------------------------------------------------------
-- RLS: a Contributor can edit Git links but cannot link a Repository
-- ---------------------------------------------------------------------------

select pg_temp.as_user(current_setting('test.contributor')::uuid);

select throws_ok(
  $$insert into public.project_repositories (project_id, team_id, github_repo_id, github_full_name, github_html_url)
    values (current_setting('test.project')::uuid, current_setting('test.team')::uuid, 5100, 'o/x', 'https://github.com/o/x')$$,
  '42501',
  null,
  'a Contributor cannot link a Repository'
);

select is(
  (select count(*)::integer from public.task_git_links where task_id = current_setting('test.task')::uuid),
  2,
  'a Contributor can read Git links'
);

-- ---------------------------------------------------------------------------
-- Development Board off / on
-- ---------------------------------------------------------------------------

select pg_temp.as_user(current_setting('test.owner')::uuid);

update public.boards set is_development = false, allowed_head_patterns = '{}'
where project_id = current_setting('test.project')::uuid and position = 0;

select is(
  (select count(*)::integer from public.board_repositories where project_id = current_setting('test.project')::uuid),
  0,
  'turning off Development Board clears its Base branches'
);

update public.boards set is_development = true
where project_id = current_setting('test.project')::uuid and position = 0;

select is(
  (select count(*)::integer from public.board_repositories where project_id = current_setting('test.project')::uuid),
  2,
  'turning on Development Board reseeds one Base branch per Repository'
);

-- ---------------------------------------------------------------------------
-- Unlink cascades Git links and logs activity on each affected Task
-- ---------------------------------------------------------------------------

delete from public.project_repositories where github_repo_id = 5001;

select is(
  (select count(*)::integer from public.task_git_links where task_id = current_setting('test.task')::uuid),
  1,
  'unlinking a Repository deletes its Git links only'
);

select is(
  (select count(*)::integer from public.activity_log
   where task_id = current_setting('test.task')::uuid
     and metadata ->> 'reason' = 'repository_unlinked'
     and metadata ->> 'repository' = 'o/web'),
  1,
  'unlinking writes an activity_log row on the affected Task'
);

select * from finish();
rollback;
