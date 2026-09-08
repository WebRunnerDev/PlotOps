-- ---------------------------------------------------------------------------
-- Auth e2e harness identities + shared Team/Project/Task (issue #255 / #257).
-- Applied on `supabase db reset` after seed.sql + seed-guest-dataset.sql
-- (see config.toml [db.seed] sql_paths).
--
-- Local-only credentials (safe to document — never reuse on remote prod):
--   User A (Team Owner):       e2e-a@plotops.app / PlotopsE2eA1
--   User B (Viewer):           e2e-b@plotops.app / PlotopsE2eB1
--   User C (Contributor):      e2e-c@plotops.app / PlotopsE2eC1
--
-- Fixed ids (also mirrored in e2e/helpers/auth-harness.ts):
--   A:       c0000000-0000-4000-8000-000000000001
--   B:       c0000000-0000-4000-8000-000000000002
--   C:       c0000000-0000-4000-8000-000000000003
--   Team:    c0000000-0000-4000-8000-000000000010
--   Project: c0000000-0000-4000-8000-000000000020
--   Task:    c0000000-0000-4000-8000-000000000030  → task_key TASK-1
--
-- Docs: docs/SUPABASE.md → Auth e2e harness.
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'c0000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'e2e-a@plotops.app',
    extensions.crypt('PlotopsE2eA1', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'first_name', 'E2E',
      'last_name', 'Alpha',
      'user_name', 'e2e-a'
    ),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'c0000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'e2e-b@plotops.app',
    extensions.crypt('PlotopsE2eB1', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'first_name', 'E2E',
      'last_name', 'Bravo',
      'user_name', 'e2e-b'
    ),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'c0000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'e2e-c@plotops.app',
    extensions.crypt('PlotopsE2eC1', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'first_name', 'E2E',
      'last_name', 'Charlie',
      'user_name', 'e2e-c'
    ),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
on conflict (id) do nothing;

insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'sub', 'c0000000-0000-4000-8000-000000000001',
      'email', 'e2e-a@plotops.app',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    'c0000000-0000-4000-8000-000000000001',
    now(),
    now(),
    now()
  ),
  (
    'c0000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000002',
    jsonb_build_object(
      'sub', 'c0000000-0000-4000-8000-000000000002',
      'email', 'e2e-b@plotops.app',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    'c0000000-0000-4000-8000-000000000002',
    now(),
    now(),
    now()
  ),
  (
    'c0000000-0000-4000-8000-000000000003',
    'c0000000-0000-4000-8000-000000000003',
    jsonb_build_object(
      'sub', 'c0000000-0000-4000-8000-000000000003',
      'email', 'e2e-c@plotops.app',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    'c0000000-0000-4000-8000-000000000003',
    now(),
    now(),
    now()
  )
on conflict (provider_id, provider) do nothing;

insert into public.profiles (id, username, avatar_url, first_name, last_name)
values
  (
    'c0000000-0000-4000-8000-000000000001',
    'e2e-a',
    null,
    'E2E',
    'Alpha'
  ),
  (
    'c0000000-0000-4000-8000-000000000002',
    'e2e-b',
    null,
    'E2E',
    'Bravo'
  ),
  (
    'c0000000-0000-4000-8000-000000000003',
    'e2e-c',
    null,
    'E2E',
    'Charlie'
  )
on conflict (id) do update
set
  username = coalesce(nullif(trim(public.profiles.username), ''), excluded.username),
  first_name = coalesce(
    nullif(trim(public.profiles.first_name), ''),
    excluded.first_name
  ),
  last_name = coalesce(
    nullif(trim(public.profiles.last_name), ''),
    excluded.last_name
  );

do $e2e_auth_dataset$
declare
  user_a constant uuid := 'c0000000-0000-4000-8000-000000000001';
  user_b constant uuid := 'c0000000-0000-4000-8000-000000000002';
  user_c constant uuid := 'c0000000-0000-4000-8000-000000000003';
  team_id constant uuid := 'c0000000-0000-4000-8000-000000000010';
  proj_id constant uuid := 'c0000000-0000-4000-8000-000000000020';
  task_id constant uuid := 'c0000000-0000-4000-8000-000000000030';
  board_id uuid;
begin
  if exists (select 1 from public.teams where id = team_id) then
    -- Idempotent team: still ensure User C membership for #257 Mentionee vs Watcher.
    insert into public.team_members (team_id, user_id, role, created_at, updated_at)
    values (
      team_id,
      user_c,
      'contributor'::public.project_member_role,
      now() - interval '5 days',
      now() - interval '5 days'
    )
    on conflict (team_id, user_id) do nothing;
    raise notice 'Auth e2e dataset already present (team %) — ensured User C', team_id;
    return;
  end if;

  if not exists (select 1 from public.profiles where id = user_a)
     or not exists (select 1 from public.profiles where id = user_b)
     or not exists (select 1 from public.profiles where id = user_c) then
    raise exception
      'Auth e2e profiles missing — create auth users/profiles before dataset seed';
  end if;

  insert into public.teams (id, owner_id, name, created_at, updated_at)
  values (
    team_id,
    user_a,
    'E2E Auth Team',
    now() - interval '7 days',
    now() - interval '1 day'
  );

  -- Owner has access via teams.owner_id; B is Viewer for manage-Watchers e2e (#256);
  -- C is Contributor Watcher for Mentionee dedupe e2e (#257).
  insert into public.team_members (team_id, user_id, role, created_at, updated_at)
  values
    (
      team_id,
      user_b,
      'viewer'::public.project_member_role,
      now() - interval '6 days',
      now() - interval '6 days'
    ),
    (
      team_id,
      user_c,
      'contributor'::public.project_member_role,
      now() - interval '5 days',
      now() - interval '5 days'
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
  values (
    proj_id,
    team_id,
    'E2E Auth Project',
    'e2e-auth',
    null,
    null,
    null,
    'main',
    'Shared Project for multi-user Auth Playwright harness.',
    false,
    now() - interval '6 days',
    now() - interval '1 day'
  );

  select b.id into board_id
  from public.boards as b
  where b.project_id = proj_id
  order by b.position
  limit 1;

  if board_id is null then
    raise exception 'Expected default board after Auth e2e project insert';
  end if;

  insert into public.tasks (
    id,
    project_id,
    board_id,
    title,
    description,
    status,
    priority,
    position,
    assignee_id,
    author_id,
    task_type,
    created_at
  )
  values (
    task_id,
    proj_id,
    board_id,
    'Shared Auth e2e Task',
    '<p>Opened by both User A and User B in separate Playwright contexts.</p>',
    'todo',
    'medium',
    0,
    user_a,
    user_a,
    'task',
    now() - interval '2 days'
  );

  raise notice
    'Auth e2e dataset seeded: team %, project %, task TASK-1 (id %)',
    team_id,
    proj_id,
    task_id;
end;
$e2e_auth_dataset$;
