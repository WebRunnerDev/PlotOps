-- Several Git links per Task per Repository (ADR 0036, #352): one row per PR,
-- one branch-only row per branch, and update_task_details addresses a Git
-- link by id.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

select set_config('test.owner', 'f6000000-0000-0000-0000-000000000001', true);
select set_config('test.team', 'f6100000-0000-0000-0000-000000000001', true);
select set_config('test.task', 'f6200000-0000-0000-0000-000000000001', true);
select set_config('test.link_a', 'f6300000-0000-0000-0000-00000000000a', true);
select set_config('test.link_b', 'f6300000-0000-0000-0000-00000000000b', true);

set local role postgres;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (current_setting('test.owner')::uuid, 'authenticated', 'authenticated', 'many-links-owner@test.com', crypt('x', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, username)
values (current_setting('test.owner')::uuid, 'many-links-owner')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values (current_setting('test.team')::uuid, current_setting('test.owner')::uuid, 'Many Links Team');

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

create or replace function pg_temp.links()
returns text
language sql
as $$
  select coalesce(string_agg(
    coalesce(l.branch_name, '-') || '#' || coalesce(l.pr_number::text, '-') || ':' || coalesce(l.pr_state, '-'),
    ',' order by l.created_at, l.branch_name
  ), '')
  from public.task_git_links as l
  where l.task_id = current_setting('test.task')::uuid;
$$;

select pg_temp.as_user(current_setting('test.owner')::uuid);

select set_config(
  'test.project',
  public.create_project_with_repositories(
    current_setting('test.team')::uuid,
    'Many Links',
    'many-links',
    null,
    false,
    '[{"github_repo_id": 7001, "github_full_name": "o/web", "github_html_url": "https://github.com/o/web", "github_default_branch": "main"}]'::jsonb
  )::text,
  true
);

select set_config(
  'test.repo',
  (select id::text from public.project_repositories where github_repo_id = 7001),
  true
);

insert into public.tasks (id, project_id, board_id, title, status, position)
select current_setting('test.task')::uuid, current_setting('test.project')::uuid, b.id, 'Login', 'todo', 0
from public.boards as b
where b.project_id = current_setting('test.project')::uuid and b.position = 0;

-- 1. New ids add Git links in the same Repository.
select lives_ok(
  format(
    $$select public.update_task_details(%L::uuid, %L::jsonb)$$,
    current_setting('test.task'),
    jsonb_build_object(
      'git_link_id', current_setting('test.link_a'),
      'repository_id', current_setting('test.repo'),
      'branch_name', 'feature/TASK-1-login',
      'pr_number', 5, 'pr_state', 'open', 'pr_url', 'https://github.com/o/web/pull/5'
    )
  ),
  'update_task_details adds a Git link with the app''s id'
);

select lives_ok(
  format(
    $$select public.update_task_details(%L::uuid, %L::jsonb)$$,
    current_setting('test.task'),
    jsonb_build_object(
      'git_link_id', current_setting('test.link_b'),
      'repository_id', current_setting('test.repo'),
      'branch_name', 'hotfix/TASK-1',
      'pr_number', 6, 'pr_state', 'open', 'pr_url', 'https://github.com/o/web/pull/6'
    )
  ),
  'a second PR of the Task in the same Repository is another Git link'
);

select is(
  (select count(*)::integer from public.task_git_links where task_id = current_setting('test.task')::uuid),
  2,
  'the Task holds two Git links in one Repository'
);

select is(
  (select id::text from public.task_git_links where pr_number = 6),
  current_setting('test.link_b'),
  'the Git link keeps the id the app chose'
);

-- 2. Uniqueness: one row per PR, one branch-only row per branch.
select throws_ok(
  format(
    $$select public.update_task_details(%L::uuid, %L::jsonb)$$,
    current_setting('test.task'),
    jsonb_build_object(
      'git_link_id', gen_random_uuid(),
      'repository_id', current_setting('test.repo'),
      'pr_number', 6, 'pr_state', 'open', 'pr_url', 'https://github.com/o/web/pull/6'
    )
  ),
  '23505',
  null,
  'the same PR twice in one Repository is rejected'
);

select lives_ok(
  format(
    $$select public.update_task_details(%L::uuid, %L::jsonb)$$,
    current_setting('test.task'),
    jsonb_build_object(
      'git_link_id', gen_random_uuid(),
      'repository_id', current_setting('test.repo'),
      'branch_name', 'spike/TASK-1'
    )
  ),
  'a branch-only Git link is added'
);

select throws_ok(
  $$insert into public.task_git_links (task_id, repository_id, project_id, branch_name)
    values (current_setting('test.task')::uuid, current_setting('test.repo')::uuid, current_setting('test.project')::uuid, 'spike/TASK-1')$$,
  '23505',
  null,
  'the same branch-only Git link twice is rejected'
);

-- 3. Without an id the Repository's Git link is ambiguous.
select throws_ok(
  format(
    $$select public.update_task_details(%L::uuid, %L::jsonb)$$,
    current_setting('test.task'),
    jsonb_build_object('repository_id', current_setting('test.repo'), 'branch_name', null)
  ),
  '22023',
  'git_link_id is required when the Task has 3 Git links in this Repository',
  'a write without git_link_id is refused when the Repository holds several'
);

-- 4. An id addresses exactly one Git link.
select lives_ok(
  format(
    $$select public.update_task_details(%L::uuid, %L::jsonb)$$,
    current_setting('test.task'),
    jsonb_build_object(
      'git_link_id', current_setting('test.link_b'),
      'pr_number', 6, 'pr_state', 'merged', 'pr_url', 'https://github.com/o/web/pull/6'
    )
  ),
  'an existing id updates that Git link (Repository taken from the row)'
);

select is(
  pg_temp.links(),
  'feature/TASK-1-login#5:open,hotfix/TASK-1#6:merged,spike/TASK-1#-:-',
  'only the addressed Git link changed'
);

select lives_ok(
  format(
    $$select public.update_task_details(%L::uuid, %L::jsonb)$$,
    current_setting('test.task'),
    jsonb_build_object(
      'git_link_id', current_setting('test.link_a'),
      'branch_name', null, 'pr_number', null, 'pr_state', null, 'pr_url', null
    )
  ),
  'clearing both fields of an id removes that Git link'
);

select is(
  pg_temp.links(),
  'hotfix/TASK-1#6:merged,spike/TASK-1#-:-',
  'the other Git links stay'
);

-- 5. The unlink is remembered per Git link (task_git_links_remember_unlink).
select is(
  (select string_agg(kind || '=' || value, ',' order by kind)
   from public.task_git_link_dismissals
   where task_id = current_setting('test.task')::uuid),
  'branch=feature/TASK-1-login,pr=5',
  'removing one Git link dismisses its branch and PR'
);

-- 6. Before ADR 0036 callers sent no id: still fine with one Git link.
delete from public.task_git_links
where task_id = current_setting('test.task')::uuid and branch_name = 'spike/TASK-1';

select lives_ok(
  format(
    $$select public.update_task_details(%L::uuid, %L::jsonb)$$,
    current_setting('test.task'),
    jsonb_build_object('branch_name', 'hotfix/TASK-1-renamed')
  ),
  'without an id the single Git link of the only Repository is updated'
);

select * from finish();
rollback;
