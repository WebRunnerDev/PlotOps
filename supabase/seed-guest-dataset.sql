-- ---------------------------------------------------------------------------
-- Guest Mode demo dataset (Wave 0 slice 2)
-- Fixed UUIDs for reproducible local reset + remote one-off SQL Editor runs.
-- Sourced from seed.sql (identity above this block) or pasted alone remotely
-- after the demo auth user + profiles row exist.
-- ---------------------------------------------------------------------------

do $guest_dataset$
declare
  guest_id constant uuid := 'a0000000-0000-4000-8000-000000000001';
  team_id constant uuid := 'b0000000-0000-4000-8000-000000000001';
  proj_git_id constant uuid := 'b0000000-0000-4000-8000-000000000010';
  proj_plain_id constant uuid := 'b0000000-0000-4000-8000-000000000011';
  board_git_id uuid;
  board_plain_id uuid;
  sprint_active_id constant uuid := 'b0000000-0000-4000-8000-000000000020';
  sprint_draft_id constant uuid := 'b0000000-0000-4000-8000-000000000021';
  label_frontend constant uuid := 'b0000000-0000-4000-8000-000000000030';
  label_backend constant uuid := 'b0000000-0000-4000-8000-000000000031';
  label_ci constant uuid := 'b0000000-0000-4000-8000-000000000032';
  label_docs constant uuid := 'b0000000-0000-4000-8000-000000000033';
  label_design constant uuid := 'b0000000-0000-4000-8000-000000000034';
  t01 constant uuid := 'b0000000-0000-4000-8000-000000000101';
  t02 constant uuid := 'b0000000-0000-4000-8000-000000000102';
  t03 constant uuid := 'b0000000-0000-4000-8000-000000000103';
  t04 constant uuid := 'b0000000-0000-4000-8000-000000000104';
  t05 constant uuid := 'b0000000-0000-4000-8000-000000000105';
  t06 constant uuid := 'b0000000-0000-4000-8000-000000000106';
  t07 constant uuid := 'b0000000-0000-4000-8000-000000000107';
  t08 constant uuid := 'b0000000-0000-4000-8000-000000000108';
  t09 constant uuid := 'b0000000-0000-4000-8000-000000000109';
  t10 constant uuid := 'b0000000-0000-4000-8000-000000000110';
  t11 constant uuid := 'b0000000-0000-4000-8000-000000000111';
  t12 constant uuid := 'b0000000-0000-4000-8000-000000000112';
  t13 constant uuid := 'b0000000-0000-4000-8000-000000000113';
  t14 constant uuid := 'b0000000-0000-4000-8000-000000000114';
  t15 constant uuid := 'b0000000-0000-4000-8000-000000000115';
  sprint_triggers_disabled boolean := false;
begin
  if exists (select 1 from public.teams where id = team_id) then
    raise notice 'Guest demo dataset already present (team %) — skipping', team_id;
    return;
  end if;

  if not exists (select 1 from public.profiles where id = guest_id) then
    raise exception
      'Guest profile % missing — create auth user/profile before dataset seed',
      guest_id;
  end if;

  -- Sprint membership triggers call can_manage_board(auth.uid()); seed has no JWT.
  alter table public.tasks disable trigger tasks_sprint_insert_guard;
  alter table public.tasks disable trigger tasks_sprint_guard;
  alter table public.tasks disable trigger tasks_sprint_scope_events;
  sprint_triggers_disabled := true;

  insert into public.teams (id, owner_id, name, created_at, updated_at)
  values (
    team_id,
    guest_id,
    'PlotOps Demo Team',
    now() - interval '21 days',
    now() - interval '2 days'
  );

  insert into public.projects (
    id,
    team_id,
    name,
    slug,
    github_repo_id,
    github_full_name,
    github_html_url,
    github_default_branch,
    description,
    is_private,
    created_at,
    updated_at
  )
  values
    (
      proj_git_id,
      team_id,
      'PlotOps Demo',
      'plotops-demo',
      999000001,
      'plotops-demo/plotops',
      'https://github.com/plotops-demo/plotops',
      'main',
      'Seeded demo project with fake GitHub fields for Git/CI UI.',
      false,
      now() - interval '20 days',
      now() - interval '1 day'
    ),
    (
      proj_plain_id,
      team_id,
      'Marketing Site',
      'marketing-site',
      null,
      null,
      null,
      'main',
      'Second project without a linked GitHub repo.',
      false,
      now() - interval '18 days',
      now() - interval '3 days'
    );

  select b.id into board_git_id
  from public.boards as b
  where b.project_id = proj_git_id
  order by b.position
  limit 1;

  select b.id into board_plain_id
  from public.boards as b
  where b.project_id = proj_plain_id
  order by b.position
  limit 1;

  if board_git_id is null or board_plain_id is null then
    raise exception 'Expected default boards after project insert';
  end if;

  update public.boards
  set
    base_branch = 'main',
    allowed_head_patterns = array['feature/*', 'fix/*', 'bugfix/*']
  where id = board_git_id;

  insert into public.labels (id, project_id, name, color, created_at)
  values
    (label_frontend, proj_git_id, 'frontend', 'blue', now() - interval '19 days'),
    (label_backend, proj_git_id, 'backend', 'purple', now() - interval '19 days'),
    (label_ci, proj_git_id, 'ci', 'orange', now() - interval '19 days'),
    (label_docs, proj_git_id, 'docs', 'gray', now() - interval '19 days'),
    (label_design, proj_plain_id, 'design', 'pink', now() - interval '17 days');

  insert into public.sprints (
    id,
    board_id,
    project_id,
    name,
    goal,
    state,
    starts_on,
    ends_on,
    committed_task_ids,
    completed_task_ids,
    started_at,
    created_at,
    created_by
  )
  values
    (
      sprint_active_id,
      board_git_id,
      proj_git_id,
      'Sprint 14 — Demo Launch',
      'Ship a convincing Guest Mode walkthrough for portfolio reviewers.',
      'active',
      (current_date - 3),
      (current_date + 10),
      '{}'::uuid[],
      '{}'::uuid[],
      now() - interval '3 days',
      now() - interval '10 days',
      guest_id
    ),
    (
      sprint_draft_id,
      board_git_id,
      proj_git_id,
      'Sprint 15 — Polish',
      'Follow-ups after the demo launch.',
      'draft',
      null,
      null,
      '{}'::uuid[],
      '{}'::uuid[],
      null,
      now() - interval '2 days',
      guest_id
    );

  insert into public.tasks (
    id,
    project_id,
    board_id,
    title,
    description,
    status,
    priority,
    position,
    branch_name,
    pr_number,
    pr_state,
    pr_url,
    assignee_id,
    author_id,
    task_type,
    deadline,
    sprint_id,
    sprint_position,
    created_at
  )
  values
    (
      t01, proj_git_id, board_git_id,
      'Wire guest sign-in CTA',
      '<p>Primary secondary button on sign-in that logs in as the demo account.</p>',
      'in_progress', 'high', 0,
      'feature/TASK-1-guest-signin-cta',
      42, 'open', 'https://github.com/plotops-demo/plotops/pull/42',
      guest_id, guest_id, 'feature', current_date + 2,
      sprint_active_id, 0, now() - interval '6 days'
    ),
    (
      t02, proj_git_id, board_git_id,
      'Mock CI builds for guest session',
      '<p>Route guest sessions through the canned builds provider — no GitHub token.</p>',
      'in_progress', 'urgent', 1,
      'feature/FEAT-2-guest-ci-mock',
      43, 'open', 'https://github.com/plotops-demo/plotops/pull/43',
      guest_id, guest_id, 'feature', current_date + 1,
      sprint_active_id, 1, now() - interval '5 days'
    ),
    (
      t03, proj_git_id, board_git_id,
      'Seed demo kanban cards',
      '<p>Populate seed-guest-dataset.sql with a Team, two Projects, and about 15 colourful tasks.</p>',
      'in_review', 'high', 0,
      'feature/TASK-3-guest-seed-dataset',
      41, 'open', 'https://github.com/plotops-demo/plotops/pull/41',
      guest_id, guest_id, 'task', current_date,
      sprint_active_id, 2, now() - interval '8 days'
    ),
    (
      t04, proj_git_id, board_git_id,
      'Guest identity helper',
      '<p><code>isGuestSession</code> compares auth uid/email to the seeded demo user.</p>',
      'done', 'medium', 0,
      'feature/TASK-4-is-guest-session',
      38, 'merged', 'https://github.com/plotops-demo/plotops/pull/38',
      guest_id, guest_id, 'feature', current_date - 4,
      sprint_active_id, 3, now() - interval '12 days'
    ),
    (
      t05, proj_git_id, board_git_id,
      'Document local demo credentials',
      '<p>Capture email/password and remote seed caveats in docs/SUPABASE.md.</p>',
      'done', 'low', 1,
      'docs/TASK-5-guest-creds-docs',
      37, 'merged', 'https://github.com/plotops-demo/plotops/pull/37',
      guest_id, guest_id, 'task', current_date - 5,
      sprint_active_id, 4, now() - interval '11 days'
    ),
    (
      t06, proj_git_id, board_git_id,
      'Demo account chip in TopBar',
      '<p>Show a Demo account chip so reviewers know the data is shared.</p>',
      'todo', 'medium', 0,
      null, null, null, null,
      guest_id, guest_id, 'task', current_date + 5,
      sprint_active_id, 5, now() - interval '4 days'
    ),
    (
      t07, proj_git_id, board_git_id,
      'Narrow command palette for guests',
      '<p>Keep Search / Switch Project / Theme; decide Create Task visibility.</p>',
      'todo', 'medium', 1,
      null, null, null, null,
      null, guest_id, 'task', null,
      sprint_draft_id, 0, now() - interval '2 days'
    ),
    (
      t08, proj_git_id, board_git_id,
      'Guard delete Team in guest mode',
      '<p>Optional: hide or no-op dangerous mutations that trash the shared demo.</p>',
      'todo', 'low', 2,
      null, null, null, null,
      null, guest_id, 'task', null,
      sprint_draft_id, 1, now() - interval '2 days'
    ),
    (
      t09, proj_git_id, board_git_id,
      'Fixture commits and PR diffs',
      '<p>Git tab should return canned commits/PRs when guest has no provider_token.</p>',
      'todo', 'high', 3,
      'feature/FEAT-9-git-fixtures',
      null, null, null,
      guest_id, guest_id, 'feature', current_date + 7,
      null, null, now() - interval '3 days'
    ),
    (
      t10, proj_git_id, board_git_id,
      'Streaming fake build logs',
      '<p>Replay canned CI log lines so the CI tab looks alive without Actions.</p>',
      'todo', 'medium', 4,
      null, null, null, null,
      null, guest_id, 'feature', null,
      null, null, now() - interval '3 days'
    ),
    (
      t11, proj_git_id, board_git_id,
      'Flaky board Realtime reconnect',
      '<p>Reproduce drop under slow 3G and harden the subscription bounce.</p>',
      'in_progress', 'medium', 2,
      'fix/BUG-11-realtime-reconnect',
      39, 'open', 'https://github.com/plotops-demo/plotops/pull/39',
      guest_id, guest_id, 'bug', current_date + 3,
      null, null, now() - interval '7 days'
    ),
    (
      t12, proj_git_id, board_git_id,
      'README portfolio tour',
      '<p>Short paragraph pointing employers at Guest Mode from the README.</p>',
      'done', 'low', 2,
      null, null, null, null,
      guest_id, guest_id, 'task', current_date - 8,
      null, null, now() - interval '14 days'
    ),
    (
      t13, proj_plain_id, board_plain_id,
      'Landing hero copy refresh',
      '<p>Sharper headline for the marketing site without binding a GitHub repo.</p>',
      'todo', 'medium', 0,
      null, null, null, null,
      guest_id, guest_id, 'task', current_date + 9,
      null, null, now() - interval '5 days'
    ),
    (
      t14, proj_plain_id, board_plain_id,
      'Press kit asset list',
      '<p>Collect logos and screenshots for outbound press notes.</p>',
      'in_progress', 'low', 0,
      null, null, null, null,
      guest_id, guest_id, 'task', null,
      null, null, now() - interval '4 days'
    ),
    (
      t15, proj_plain_id, board_plain_id,
      'Broken FAQ accordion on mobile',
      '<p>Accordion fails to expand below the sm breakpoint.</p>',
      'in_review', 'high', 0,
      null, null, null, null,
      guest_id, guest_id, 'bug', current_date + 1,
      null, null, now() - interval '6 days'
    );

  update public.sprints
  set committed_task_ids = array[t01, t02, t03, t04, t05, t06]
  where id = sprint_active_id;

  insert into public.sprint_events (
    sprint_id,
    project_id,
    actor_id,
    event_type,
    payload,
    created_at
  )
  values (
    sprint_active_id,
    proj_git_id,
    guest_id,
    'started',
    jsonb_build_object(
      'committed_count', 6,
      'starts_on', (current_date - 3),
      'ends_on', (current_date + 10)
    ),
    now() - interval '3 days'
  );

  insert into public.task_labels (task_id, label_id)
  values
    (t01, label_frontend),
    (t02, label_ci),
    (t02, label_backend),
    (t03, label_backend),
    (t04, label_frontend),
    (t05, label_docs),
    (t09, label_frontend),
    (t10, label_ci),
    (t11, label_backend),
    (t12, label_docs),
    (t13, label_design),
    (t15, label_design);

  insert into public.activity_log (
    task_id,
    project_id,
    user_id,
    action,
    metadata,
    created_at
  )
  values
    (
      t01, proj_git_id, guest_id, 'updated',
      jsonb_build_object(
        'changes', jsonb_build_array(
          jsonb_build_object(
            'field', 'status',
            'from', jsonb_build_object('name', 'To Do'),
            'to', jsonb_build_object('name', 'In Progress')
          )
        )
      ),
      now() - interval '2 days'
    ),
    (
      t02, proj_git_id, guest_id, 'updated',
      jsonb_build_object(
        'changes', jsonb_build_array(
          jsonb_build_object(
            'field', 'priority',
            'from', 'high',
            'to', 'urgent'
          )
        )
      ),
      now() - interval '1 day'
    ),
    (
      t03, proj_git_id, guest_id, 'updated',
      jsonb_build_object(
        'changes', jsonb_build_array(
          jsonb_build_object(
            'field', 'pr',
            'from', null,
            'to', jsonb_build_object('number', 41, 'state', 'open')
          )
        )
      ),
      now() - interval '20 hours'
    ),
    (
      t04, proj_git_id, guest_id, 'updated',
      jsonb_build_object(
        'changes', jsonb_build_array(
          jsonb_build_object(
            'field', 'status',
            'from', jsonb_build_object('name', 'In Review'),
            'to', jsonb_build_object('name', 'Done')
          )
        )
      ),
      now() - interval '4 days'
    ),
    (
      t11, proj_git_id, guest_id, 'updated',
      jsonb_build_object(
        'changes', jsonb_build_array(
          jsonb_build_object(
            'field', 'assignee',
            'from', null,
            'to', jsonb_build_object('name', 'Demo Guest')
          )
        )
      ),
      now() - interval '6 days'
    ),
    (
      t15, proj_plain_id, guest_id, 'updated',
      jsonb_build_object(
        'changes', jsonb_build_array(
          jsonb_build_object(
            'field', 'status',
            'from', jsonb_build_object('name', 'In Progress'),
            'to', jsonb_build_object('name', 'In Review')
          )
        )
      ),
      now() - interval '12 hours'
    );

  insert into public.task_comments (
    task_id,
    project_id,
    author_id,
    body,
    created_at,
    updated_at
  )
  values
    (
      t01, proj_git_id, guest_id,
      '<p>CTA should sit next to GitHub OAuth and use the env credentials.</p>',
      now() - interval '30 hours',
      now() - interval '30 hours'
    ),
    (
      t02, proj_git_id, guest_id,
      '<p>Reuse the existing mock builds provider from CI tests.</p>',
      now() - interval '18 hours',
      now() - interval '18 hours'
    ),
    (
      t03, proj_git_id, guest_id,
      '<p>Fixed UUIDs so remote SQL Editor seed matches local db:reset.</p>',
      now() - interval '10 hours',
      now() - interval '10 hours'
    ),
    (
      t15, proj_plain_id, guest_id,
      '<p>Reproduced on iPhone SE — first tap does nothing.</p>',
      now() - interval '8 hours',
      now() - interval '8 hours'
    );

  -- Assignees already enroll as watchers via tasks insert trigger; add backlog
  -- watches only where assignee is null.
  insert into public.task_watchers (task_id, project_id, user_id, created_at)
  values
    (t07, proj_git_id, guest_id, now() - interval '2 days'),
    (t10, proj_git_id, guest_id, now() - interval '3 days')
  on conflict (task_id, user_id) do nothing;

  insert into public.notifications (
    recipient_id,
    project_id,
    task_id,
    kind,
    task_key,
    task_title,
    metadata,
    read_at,
    created_at
  )
  values
    (
      guest_id, proj_git_id, t02, 'assignment',
      'FEAT-2', 'Mock CI builds for guest session',
      jsonb_build_object(
        'actor', jsonb_build_object('id', guest_id, 'name', 'Demo Guest')
      ),
      null,
      now() - interval '1 day'
    ),
    (
      guest_id, proj_git_id, t01, 'status_change',
      'FEAT-1', 'Wire guest sign-in CTA',
      jsonb_build_object(
        'from', 'todo',
        'to', 'in_progress',
        'actor', jsonb_build_object('id', guest_id, 'name', 'Demo Guest')
      ),
      now() - interval '20 hours',
      now() - interval '2 days'
    ),
    (
      guest_id, proj_git_id, t11, 'priority_change',
      'BUG-11', 'Flaky board Realtime reconnect',
      jsonb_build_object(
        'from', 'low',
        'to', 'medium',
        'actor', jsonb_build_object('id', guest_id, 'name', 'Demo Guest')
      ),
      null,
      now() - interval '3 days'
    );

  raise notice
    'Guest demo dataset seeded: team %, projects 2, tasks 15, sprints 2',
    team_id;

  alter table public.tasks enable trigger tasks_sprint_insert_guard;
  alter table public.tasks enable trigger tasks_sprint_guard;
  alter table public.tasks enable trigger tasks_sprint_scope_events;
  sprint_triggers_disabled := false;
exception
  when others then
    if sprint_triggers_disabled then
      alter table public.tasks enable trigger tasks_sprint_insert_guard;
      alter table public.tasks enable trigger tasks_sprint_guard;
      alter table public.tasks enable trigger tasks_sprint_scope_events;
    end if;
    raise;
end;
$guest_dataset$;
