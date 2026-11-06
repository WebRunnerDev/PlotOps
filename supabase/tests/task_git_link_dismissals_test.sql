-- Auto-link memory (ADR 0035 «Auto-link», #351): a person's unlink is
-- remembered, relinking lifts it, service-role writes and cascades are not
-- unlinks, and nobody writes the table directly.
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

select set_config('test.owner', 'f5000000-0000-0000-0000-000000000001', true);
select set_config('test.team', 'f5100000-0000-0000-0000-000000000001', true);
select set_config('test.task', 'f5200000-0000-0000-0000-000000000001', true);

set local role postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (current_setting('test.owner')::uuid, 'authenticated', 'authenticated', 'dismiss-owner@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, username)
values (current_setting('test.owner')::uuid, 'dismiss-owner')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values (current_setting('test.team')::uuid, current_setting('test.owner')::uuid, 'Dismissals Team');

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

create or replace function pg_temp.as_service()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  execute 'set local role service_role';
end;
$$;

select pg_temp.as_user(current_setting('test.owner')::uuid);

select set_config(
  'test.project',
  public.create_project_with_repositories(
    current_setting('test.team')::uuid,
    'Dismissals',
    'dismissals',
    null,
    false,
    '[{"github_repo_id": 6001, "github_full_name": "o/web", "github_html_url": "https://github.com/o/web", "github_default_branch": "main"}]'::jsonb
  )::text,
  true
);

select set_config(
  'test.repo',
  (select id::text from public.project_repositories where github_repo_id = 6001),
  true
);

insert into public.tasks (id, project_id, board_id, title, status, position)
select current_setting('test.task')::uuid, current_setting('test.project')::uuid, b.id, 'Login', 'todo', 0
from public.boards as b
where b.project_id = current_setting('test.project')::uuid and b.position = 0;

-- The webhook (service role) links branch + PR: no dismissal involved.
select pg_temp.as_service();

insert into public.task_git_links (task_id, repository_id, project_id, branch_name, pr_number, pr_state)
values (current_setting('test.task')::uuid, current_setting('test.repo')::uuid, current_setting('test.project')::uuid, 'TASK-1-login', 7, 'open');

select pg_temp.as_user(current_setting('test.owner')::uuid);

-- Unlink the PR only.
select public.update_task_details(
  current_setting('test.task')::uuid,
  jsonb_build_object('repository_id', current_setting('test.repo'), 'pr_number', null, 'pr_state', null, 'pr_url', null),
  null
);

select results_eq(
  $$select kind, value from public.task_git_link_dismissals order by kind, value$$,
  $$values ('pr'::text, '7'::text)$$,
  'unlinking a PR remembers that PR for the Task and Repository'
);

select is(
  (select dismissed_by from public.task_git_link_dismissals limit 1),
  current_setting('test.owner')::uuid,
  'the dismissal records who unlinked'
);

-- Undo puts the PR back → dismissal lifted.
select public.update_task_details(
  current_setting('test.task')::uuid,
  jsonb_build_object('repository_id', current_setting('test.repo'), 'pr_number', 7, 'pr_state', 'open'),
  null
);

select is(
  (select count(*)::integer from public.task_git_link_dismissals),
  0,
  'relinking the same PR lifts its dismissal'
);

-- Unlink the whole Git link (branch + PR) → both remembered.
select public.update_task_details(
  current_setting('test.task')::uuid,
  jsonb_build_object('repository_id', current_setting('test.repo'), 'branch_name', null, 'pr_number', null),
  null
);

select is(
  (select count(*)::integer from public.task_git_links where task_id = current_setting('test.task')::uuid),
  0,
  'unlinking branch and PR deletes the Git link'
);

select results_eq(
  $$select kind, value from public.task_git_link_dismissals order by kind, value$$,
  $$values ('branch'::text, 'TASK-1-login'::text), ('pr'::text, '7'::text)$$,
  'deleting a Git link remembers both its branch and its PR'
);

select throws_ok(
  $$insert into public.task_git_link_dismissals (task_id, repository_id, project_id, kind, value)
    values (current_setting('test.task')::uuid, current_setting('test.repo')::uuid, current_setting('test.project')::uuid, 'pr', '8')$$,
  '42501',
  null,
  'members cannot write dismissals directly'
);

select is(
  (select count(*)::integer from public.task_git_link_dismissals),
  2,
  'members read dismissals of their Project'
);

-- Service-role writes never dismiss or lift.
select pg_temp.as_service();

insert into public.task_git_links (task_id, repository_id, project_id, branch_name)
values (current_setting('test.task')::uuid, current_setting('test.repo')::uuid, current_setting('test.project')::uuid, 'TASK-1-login');

delete from public.task_git_links where task_id = current_setting('test.task')::uuid;

select is(
  (select count(*)::integer from public.task_git_link_dismissals),
  2,
  'service-role link and unlink leave dismissals as they were'
);

-- Unlinking the Repository is a cascade, not a dismissal of each Git link.
select pg_temp.as_user(current_setting('test.owner')::uuid);

select public.update_task_details(
  current_setting('test.task')::uuid,
  jsonb_build_object('repository_id', current_setting('test.repo'), 'branch_name', 'feature/TASK-1-other'),
  null
);

select lives_ok(
  $$delete from public.project_repositories where id = current_setting('test.repo')::uuid$$,
  'unlinking a Repository with Git links still works'
);

set local role postgres;

select is(
  (select count(*)::integer from public.task_git_link_dismissals
   where task_id = current_setting('test.task')::uuid),
  0,
  'the Repository cascade adds no dismissals and drops the old ones'
);

select * from finish();
rollback;
