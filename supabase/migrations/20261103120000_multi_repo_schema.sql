-- Multi-repo Projects: Repositories, Git links, Base branch per Board × Repository (ADR 0034).
--
--   project_repositories  0..N GitHub repositories per Project (cap 5)
--   task_git_links        ≤1 branch / PR per Task per Repository
--   board_repositories    Base branch per Development Board × Repository
--
-- One transaction (the CLI wraps each migration file): create tables, copy the
-- single-repo columns over, reconcile row counts (RAISE EXCEPTION on any
-- mismatch rolls everything back), then drop the old columns. Triggers that
-- seed / guard the new tables are created only after the copy, so they do not
-- fire on migrated rows.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table public.project_repositories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- Denormalised from projects.team_id (set by trigger) for the Team-wide
  -- uniqueness below: a webhook delivery resolves to exactly one Project.
  team_id uuid not null references public.teams (id) on delete cascade,
  github_repo_id bigint not null,
  github_full_name text not null,
  github_html_url text not null,
  github_default_branch text not null default 'main',
  created_at timestamptz not null default now(),
  constraint project_repositories_team_github_repo_unique
    unique (team_id, github_repo_id),
  constraint project_repositories_full_name_not_blank
    check (btrim(github_full_name) <> ''),
  constraint project_repositories_default_branch_not_blank
    check (btrim(github_default_branch) <> '')
);

create index project_repositories_project_id_idx
  on public.project_repositories (project_id);
create index project_repositories_github_repo_id_idx
  on public.project_repositories (github_repo_id);
create index project_repositories_github_full_name_idx
  on public.project_repositories (github_full_name);

create table public.task_git_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  repository_id uuid not null references public.project_repositories (id) on delete cascade,
  -- Denormalised from tasks.project_id (set by trigger) for RLS.
  project_id uuid not null references public.projects (id) on delete cascade,
  branch_name text,
  pr_number integer,
  pr_url text,
  pr_state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_git_links_task_repository_unique unique (task_id, repository_id),
  constraint task_git_links_not_empty
    check (branch_name is not null or pr_number is not null),
  constraint task_git_links_pr_state_known
    check (pr_state is null or pr_state in ('open', 'closed', 'merged'))
);

create index task_git_links_project_id_idx on public.task_git_links (project_id);
create index task_git_links_repository_pr_idx
  on public.task_git_links (repository_id, pr_number)
  where pr_number is not null;
create index task_git_links_repository_branch_idx
  on public.task_git_links (repository_id, branch_name)
  where branch_name is not null;

create table public.board_repositories (
  board_id uuid not null references public.boards (id) on delete cascade,
  repository_id uuid not null references public.project_repositories (id) on delete cascade,
  -- Denormalised from boards.project_id for RLS.
  project_id uuid not null references public.projects (id) on delete cascade,
  base_branch text not null,
  primary key (board_id, repository_id),
  constraint board_repositories_base_branch_not_blank
    check (btrim(base_branch) <> '')
);

create index board_repositories_repository_id_idx
  on public.board_repositories (repository_id);
create index board_repositories_project_id_idx
  on public.board_repositories (project_id);

-- ---------------------------------------------------------------------------
-- 2. Copy single-repo columns, then reconcile
-- ---------------------------------------------------------------------------

do $$
declare
  v_src integer;
  v_dst integer;
  v_orphans integer;
  v_dropped_bases integer;
begin
  -- 2a. projects.github_* → project_repositories
  insert into public.project_repositories (
    project_id, team_id, github_repo_id, github_full_name, github_html_url,
    github_default_branch, created_at
  )
  select
    p.id,
    p.team_id,
    p.github_repo_id,
    p.github_full_name,
    coalesce(nullif(btrim(p.github_html_url), ''), 'https://github.com/' || p.github_full_name),
    coalesce(nullif(btrim(p.github_default_branch), ''), 'main'),
    p.created_at
  from public.projects as p
  where p.github_repo_id is not null;

  select count(*)::integer into v_src from public.projects where github_repo_id is not null;
  select count(*)::integer into v_dst from public.project_repositories;
  if v_src <> v_dst then
    raise exception 'multi-repo migration: project_repositories % <> source projects %', v_dst, v_src;
  end if;

  -- 2b. tasks.branch_name / pr_* → task_git_links
  -- A Git link must belong to a Repository; refuse to silently drop links on
  -- Projects that never had one.
  select count(*)::integer into v_orphans
  from public.tasks as t
  join public.projects as p on p.id = t.project_id
  where (t.branch_name is not null or t.pr_number is not null)
    and p.github_repo_id is null;
  if v_orphans > 0 then
    raise exception 'multi-repo migration: % Tasks hold a branch / PR in a Project without a repository', v_orphans;
  end if;

  insert into public.task_git_links (
    task_id, repository_id, project_id, branch_name, pr_number, pr_url, pr_state
  )
  select
    t.id,
    r.id,
    t.project_id,
    t.branch_name,
    t.pr_number,
    t.pr_url,
    t.pr_state
  from public.tasks as t
  join public.project_repositories as r on r.project_id = t.project_id
  where t.branch_name is not null or t.pr_number is not null;

  select count(*)::integer into v_src
  from public.tasks where branch_name is not null or pr_number is not null;
  select count(*)::integer into v_dst from public.task_git_links;
  if v_src <> v_dst then
    raise exception 'multi-repo migration: task_git_links % <> source tasks %', v_dst, v_src;
  end if;

  -- 2c. boards.base_branch → board_repositories (Development Boards only)
  insert into public.board_repositories (board_id, repository_id, project_id, base_branch)
  select
    b.id,
    r.id,
    b.project_id,
    coalesce(nullif(btrim(b.base_branch), ''), r.github_default_branch)
  from public.boards as b
  join public.project_repositories as r on r.project_id = b.project_id
  where b.is_development;

  select count(*)::integer into v_src
  from public.boards as b
  join public.projects as p on p.id = b.project_id
  where b.is_development and p.github_repo_id is not null;
  select count(*)::integer into v_dst from public.board_repositories;
  if v_src <> v_dst then
    raise exception 'multi-repo migration: board_repositories % <> source boards %', v_dst, v_src;
  end if;

  -- Development Boards in repo-less Projects keep is_development; their Base
  -- branch has no Repository to belong to and is reseeded when one is added.
  select count(*)::integer into v_dropped_bases
  from public.boards as b
  join public.projects as p on p.id = b.project_id
  where b.base_branch is not null and p.github_repo_id is null;
  if v_dropped_bases > 0 then
    raise notice 'multi-repo migration: % Base branches on repo-less Projects not carried over', v_dropped_bases;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Drop the single-repo columns
-- ---------------------------------------------------------------------------

alter table public.boards drop constraint if exists boards_development_git_mapping;
alter table public.boards
  add constraint boards_development_git_mapping
  check (is_development or coalesce(cardinality(allowed_head_patterns), 0) = 0);

-- tasks_archive_guard reads the git columns; replace it before the drop.
create or replace function public.tasks_archive_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  was_archived boolean := old.archived_at is not null;
  will_archive boolean := new.archived_at is not null;
  is_archive_transition boolean := (not was_archived) and will_archive;
  is_restore_transition boolean := was_archived and (not will_archive);
  content_changed boolean;
  board_maintenance boolean;
  next_position integer;
  restore_sprint_id uuid;
begin
  if is_archive_transition then
    if not public.can_delete_tasks(old.project_id) then
      raise exception 'Only managers can archive tasks'
        using errcode = '42501';
    end if;

    perform public.assert_parent_task_may_archive(old.id);

    next_position := new.position;
    new := old;
    new.position := next_position;
    new.archived_at := now();
    new.archived_by := (select auth.uid());
    new.sprint_id := null;
    new.sprint_position := null;
    return new;
  end if;

  if is_restore_transition then
    if not public.can_delete_tasks(old.project_id) then
      raise exception 'Only managers can restore tasks'
        using errcode = '42501';
    end if;

    next_position := new.position;
    new := old;
    new.position := next_position;
    new.archived_at := null;
    new.archived_by := null;
    new.sprint_id := null;
    new.sprint_position := null;

    if old.parent_id is not null then
      select s.id
        into restore_sprint_id
      from public.tasks as parent
      join public.sprints as s
        on s.id = parent.sprint_id
      where parent.id = old.parent_id
        and parent.archived_at is null
        and s.state in ('draft', 'active');

      if restore_sprint_id is not null then
        new.sprint_id := restore_sprint_id;
        select coalesce(max(t.sprint_position), -1) + 1
          into new.sprint_position
        from public.tasks as t
        where t.sprint_id = restore_sprint_id
          and t.archived_at is null
          and t.id is distinct from old.id;
      end if;
    end if;

    return new;
  end if;

  if was_archived and will_archive then
    new.archived_at := old.archived_at;
    new.archived_by := old.archived_by;

    -- Git links live in task_git_links and are guarded there.
    content_changed :=
      new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.priority is distinct from old.priority
      or new.deadline is distinct from old.deadline
      or new.assignee_id is distinct from old.assignee_id
      or new.author_id is distinct from old.author_id
      or new.task_type is distinct from old.task_type
      or new.board_id is distinct from old.board_id
      or new.project_id is distinct from old.project_id
      or new.sprint_id is distinct from old.sprint_id
      or new.sprint_position is distinct from old.sprint_position;

    board_maintenance :=
      new.status is distinct from old.status
      or new.position is distinct from old.position;

    if content_changed then
      raise exception 'Task is archived and cannot be modified'
        using errcode = 'P0001';
    end if;

    if board_maintenance and not public.can_manage_board(old.project_id) then
      raise exception 'Task is archived and cannot be modified'
        using errcode = 'P0001';
    end if;

    return new;
  end if;

  new.archived_by := null;
  new.archived_at := null;
  return new;
end;
$$;

-- Default board no longer reads projects.github_*: a fresh Project has no
-- Repositories yet. create_project_with_repositories turns the Main board into
-- a Development Board once its Repositories are in.
create or replace function public.handle_new_project_board()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_board_id uuid;
begin
  insert into public.boards (
    project_id,
    name,
    position,
    allowed_head_patterns,
    is_development
  )
  values (
    new.id,
    'Main',
    0,
    '{}',
    false
  )
  returning id into new_board_id;

  insert into public.board_columns (id, board_id, project_id, name, position, is_done)
  values
    ('todo', new_board_id, new.id, 'To Do', 0, false),
    ('in_progress', new_board_id, new.id, 'In Progress', 1, false),
    ('in_review', new_board_id, new.id, 'In Review', 2, false),
    ('done', new_board_id, new.id, 'Done', 3, true);

  return new;
end;
$$;

-- update_task_details reads the git columns; drop it here and recreate below.
drop function if exists public.update_task_details(uuid, jsonb, uuid[]);

alter table public.projects
  drop column github_repo_id,
  drop column github_full_name,
  drop column github_html_url,
  drop column github_default_branch;

alter table public.tasks
  drop column branch_name,
  drop column pr_number,
  drop column pr_url,
  drop column pr_state;

alter table public.boards drop column base_branch;

-- ---------------------------------------------------------------------------
-- 4. Repository cap (ADR 0032 style) + Repository triggers
-- ---------------------------------------------------------------------------

create or replace function public.project_repositories_cap()
returns integer
language sql
immutable
set search_path = ''
as $$ select 5 $$;

revoke all on function public.project_repositories_cap() from public;
grant execute on function public.project_repositories_cap() to authenticated;

-- Sets team_id from the Project and enforces the cap. Security definer: the
-- count must see every Repository of the Project.
create or replace function public.project_repositories_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap integer := public.project_repositories_cap();
  v_count integer;
begin
  select p.team_id into new.team_id
  from public.projects as p
  where p.id = new.project_id;

  if new.team_id is null then
    raise exception 'Project not found'
      using errcode = 'P0002';
  end if;

  -- Serialise concurrent inserts into one Project so the cap cannot be raced.
  perform 1 from public.projects as p where p.id = new.project_id for update;

  select count(*)::integer
  into v_count
  from public.project_repositories as r
  where r.project_id = new.project_id;

  if v_count >= v_cap then
    raise exception 'A Project may hold at most % Repositories', v_cap
      using errcode = 'P0001', hint = 'project_repositories_cap';
  end if;

  new.github_default_branch :=
    coalesce(nullif(btrim(new.github_default_branch), ''), 'main');

  return new;
end;
$$;

revoke all on function public.project_repositories_before_insert() from public;

create trigger project_repositories_before_insert
  before insert on public.project_repositories
  for each row
  execute function public.project_repositories_before_insert();

-- A Repository joins every Development Board of its Project with its default
-- branch as Base branch.
create or replace function public.project_repositories_seed_boards()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.board_repositories (board_id, repository_id, project_id, base_branch)
  select b.id, new.id, new.project_id, new.github_default_branch
  from public.boards as b
  where b.project_id = new.project_id
    and b.is_development
  on conflict (board_id, repository_id) do nothing;

  return new;
end;
$$;

revoke all on function public.project_repositories_seed_boards() from public;

create trigger project_repositories_seed_boards
  after insert on public.project_repositories
  for each row
  execute function public.project_repositories_seed_boards();

-- Unlinking a Repository cascades its Git links; record that on each Task.
-- Skipped while the whole Project is being deleted (Tasks go too).
create or replace function public.project_repositories_log_unlink()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.projects as p where p.id = old.project_id) then
    return old;
  end if;

  insert into public.activity_log (task_id, project_id, user_id, action, metadata)
  select
    l.task_id,
    l.project_id,
    (select auth.uid()),
    'updated',
    jsonb_build_object(
      'changes',
      (
        case when l.branch_name is not null then
          jsonb_build_array(jsonb_build_object(
            'field', 'branch', 'from', l.branch_name, 'to', null
          ))
        else '[]'::jsonb end
      ) || (
        case when l.pr_number is not null then
          jsonb_build_array(jsonb_build_object(
            'field', 'pr',
            'from', jsonb_build_object(
              'number', l.pr_number,
              'state', coalesce(l.pr_state, 'open'),
              'url', l.pr_url
            ),
            'to', null
          ))
        else '[]'::jsonb end
      ),
      'repository', old.github_full_name,
      'reason', 'repository_unlinked'
    )
  from public.task_git_links as l
  join public.tasks as t on t.id = l.task_id
  where l.repository_id = old.id;

  return old;
end;
$$;

revoke all on function public.project_repositories_log_unlink() from public;

create trigger project_repositories_log_unlink
  before delete on public.project_repositories
  for each row
  execute function public.project_repositories_log_unlink();

-- ---------------------------------------------------------------------------
-- 5. Git link + Board × Repository triggers
-- ---------------------------------------------------------------------------

-- project_id follows the Task; the Repository must belong to the same Project;
-- archived Tasks are read-only (as tasks_archive_guard did for the old columns).
create or replace function public.task_git_links_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task_project uuid;
  v_archived timestamptz;
  v_repo_project uuid;
begin
  select t.project_id, t.archived_at
  into v_task_project, v_archived
  from public.tasks as t
  where t.id = new.task_id;

  if v_task_project is null then
    raise exception 'Task not found'
      using errcode = 'P0002';
  end if;

  if v_archived is not null then
    raise exception 'Task is archived and cannot be modified'
      using errcode = 'P0001';
  end if;

  select r.project_id into v_repo_project
  from public.project_repositories as r
  where r.id = new.repository_id;

  if v_repo_project is distinct from v_task_project then
    raise exception 'Repository does not belong to the Task''s Project'
      using errcode = '23514';
  end if;

  new.project_id := v_task_project;
  new.branch_name := nullif(btrim(new.branch_name), '');
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
  end if;

  return new;
end;
$$;

revoke all on function public.task_git_links_before_write() from public;

create trigger task_git_links_before_write
  before insert or update on public.task_git_links
  for each row
  execute function public.task_git_links_before_write();

create or replace function public.board_repositories_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board_project uuid;
  v_repo_project uuid;
begin
  select b.project_id into v_board_project
  from public.boards as b where b.id = new.board_id;

  select r.project_id into v_repo_project
  from public.project_repositories as r where r.id = new.repository_id;

  if v_board_project is null or v_board_project is distinct from v_repo_project then
    raise exception 'Board and Repository must belong to the same Project'
      using errcode = '23514';
  end if;

  new.project_id := v_board_project;
  new.base_branch := btrim(new.base_branch);
  return new;
end;
$$;

revoke all on function public.board_repositories_before_write() from public;

create trigger board_repositories_before_write
  before insert or update on public.board_repositories
  for each row
  execute function public.board_repositories_before_write();

-- Turning a Board into a Development Board seeds one row per Repository from
-- its default branch; turning it off clears them.
create or replace function public.boards_sync_repositories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_development and (tg_op = 'INSERT' or not old.is_development) then
    insert into public.board_repositories (board_id, repository_id, project_id, base_branch)
    select new.id, r.id, new.project_id, r.github_default_branch
    from public.project_repositories as r
    where r.project_id = new.project_id
    on conflict (board_id, repository_id) do nothing;
  elsif tg_op = 'UPDATE' and old.is_development and not new.is_development then
    delete from public.board_repositories
    where board_id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function public.boards_sync_repositories() from public;

create trigger boards_sync_repositories
  after insert or update of is_development on public.boards
  for each row
  execute function public.boards_sync_repositories();

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------

alter table public.project_repositories enable row level security;
alter table public.task_git_links enable row level security;
alter table public.board_repositories enable row level security;

-- project_repositories — like projects: Team members read, Admin+ write.
create policy project_repositories_select_member
  on public.project_repositories for select to authenticated
  using (public.is_team_member(team_id));

create policy project_repositories_insert_admins
  on public.project_repositories for insert to authenticated
  with check (public.can_manage_project_settings(project_id));

create policy project_repositories_update_admins
  on public.project_repositories for update to authenticated
  using (public.can_manage_project_settings(project_id))
  with check (public.can_manage_project_settings(project_id));

create policy project_repositories_delete_admins
  on public.project_repositories for delete to authenticated
  using (public.can_manage_project_settings(project_id));

-- task_git_links — like tasks: viewers read, editors write (unchanged rights).
create policy task_git_links_select_member
  on public.task_git_links for select to authenticated
  using (public.can_view_project(project_id));

create policy task_git_links_insert_editors
  on public.task_git_links for insert to authenticated
  with check (public.can_edit_tasks(project_id));

create policy task_git_links_update_editors
  on public.task_git_links for update to authenticated
  using (public.can_edit_tasks(project_id))
  with check (public.can_edit_tasks(project_id));

create policy task_git_links_delete_editors
  on public.task_git_links for delete to authenticated
  using (public.can_edit_tasks(project_id));

-- board_repositories — like boards: viewers read, managers write.
create policy board_repositories_select_member
  on public.board_repositories for select to authenticated
  using (public.can_view_project(project_id));

create policy board_repositories_insert_managers
  on public.board_repositories for insert to authenticated
  with check (public.can_manage_board(project_id));

create policy board_repositories_update_managers
  on public.board_repositories for update to authenticated
  using (public.can_manage_board(project_id))
  with check (public.can_manage_board(project_id));

create policy board_repositories_delete_managers
  on public.board_repositories for delete to authenticated
  using (public.can_manage_board(project_id));

revoke all on public.project_repositories from anon;
revoke all on public.task_git_links from anon;
revoke all on public.board_repositories from anon;
revoke truncate, trigger, references, maintain
  on public.project_repositories, public.task_git_links, public.board_repositories
  from authenticated;
grant select, insert, update, delete
  on public.project_repositories, public.task_git_links, public.board_repositories
  to authenticated;
-- github-webhook (service role) resolves Repositories and writes Git links.
grant select, insert, update, delete
  on public.project_repositories, public.task_git_links, public.board_repositories
  to service_role;

-- ---------------------------------------------------------------------------
-- 7. RPCs
-- ---------------------------------------------------------------------------

-- Base branch, when given, overrides the default-branch seed for every
-- Repository (single-repo UI; per-Repository editing is Project Settings).
create or replace function public.create_board_with_columns(
  p_project_id uuid,
  p_name text,
  p_base_branch text,
  p_is_development boolean default true
)
returns public.boards
language plpgsql
set search_path = ''
as $$
declare
  next_position integer;
  board_row public.boards;
  board_name text;
  v_base_branch text;
  as_development boolean;
begin
  if not public.can_manage_board(p_project_id) then
    raise exception 'Only managers can create boards'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.projects as p where p.id = p_project_id
  ) then
    raise exception 'Project not found'
      using errcode = 'P0002';
  end if;

  board_name := nullif(btrim(coalesce(p_name, '')), '');
  if board_name is null then
    board_name := 'Board';
  end if;

  as_development := coalesce(p_is_development, false);
  v_base_branch := case
    when as_development then nullif(btrim(coalesce(p_base_branch, '')), '')
    else null
  end;

  select coalesce(max(b.position), -1) + 1 into next_position
  from public.boards as b
  where b.project_id = p_project_id;

  insert into public.boards (
    project_id,
    name,
    position,
    allowed_head_patterns,
    is_development
  )
  values (
    p_project_id,
    board_name,
    next_position,
    '{}',
    as_development
  )
  returning * into board_row;

  if v_base_branch is not null then
    update public.board_repositories as br
    set base_branch = v_base_branch
    where br.board_id = board_row.id;
  end if;

  insert into public.board_columns (id, board_id, project_id, name, position, is_done)
  values
    ('todo', board_row.id, p_project_id, 'To Do', 0, false),
    ('in_progress', board_row.id, p_project_id, 'In Progress', 1, false),
    ('in_review', board_row.id, p_project_id, 'In Review', 2, false),
    ('done', board_row.id, p_project_id, 'Done', 3, true);

  return board_row;
end;
$$;

-- Create a Project and its Repositories atomically. With at least one
-- Repository the default Main board becomes a Development Board (as when
-- projects.github_repo_id drove handle_new_project_board).
--   p_repositories: [{ github_repo_id, github_full_name, github_html_url, github_default_branch }]
create or replace function public.create_project_with_repositories(
  p_team_id uuid,
  p_name text,
  p_slug text,
  p_description text default null,
  p_is_private boolean default false,
  p_repositories jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_repos jsonb := coalesce(p_repositories, '[]'::jsonb);
begin
  if jsonb_typeof(v_repos) <> 'array' then
    raise exception 'p_repositories must be an array'
      using errcode = '22023';
  end if;

  insert into public.projects (team_id, name, slug, description, is_private)
  values (p_team_id, p_name, p_slug, p_description, coalesce(p_is_private, false))
  returning id into v_project_id;

  insert into public.project_repositories (
    project_id, team_id, github_repo_id, github_full_name, github_html_url, github_default_branch
  )
  select
    v_project_id,
    p_team_id,
    (r ->> 'github_repo_id')::bigint,
    r ->> 'github_full_name',
    coalesce(nullif(r ->> 'github_html_url', ''), 'https://github.com/' || (r ->> 'github_full_name')),
    coalesce(nullif(btrim(r ->> 'github_default_branch'), ''), 'main')
  from jsonb_array_elements(v_repos) with ordinality as e(r, ord)
  order by e.ord;

  if jsonb_array_length(v_repos) > 0 then
    update public.boards as b
    set is_development = true
    where b.project_id = v_project_id
      and not b.is_development;
  end if;

  return v_project_id;
end;
$$;

revoke all on function public.create_project_with_repositories(uuid, text, text, text, boolean, jsonb) from public, anon;
grant execute on function public.create_project_with_repositories(uuid, text, text, text, boolean, jsonb) to authenticated;

-- Git fields (branch_name, pr_number, pr_state, pr_url) now write the Task's
-- Git link for `repository_id`; it may be omitted when the Project has exactly
-- one Repository. A Git link left with neither branch nor PR is removed.
create function public.update_task_details(
  p_task_id uuid,
  p_patch jsonb default '{}'::jsonb,
  p_label_ids uuid[] default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  task_project uuid;
  patch jsonb := coalesce(p_patch, '{}'::jsonb);
  label_ids uuid[];
  distinct_count integer;
  matched_count integer;
  v_repository_id uuid;
  v_repo_count integer;
  v_link public.task_git_links;
  v_branch text;
  v_pr_number integer;
  v_pr_state text;
  v_pr_url text;
begin
  select t.project_id into task_project
  from public.tasks as t
  where t.id = p_task_id;

  if task_project is null then
    raise exception 'Task not found'
      using errcode = 'P0002';
  end if;

  if not public.can_edit_tasks(task_project) then
    raise exception 'Only editors can update tasks'
      using errcode = '42501';
  end if;

  if patch ? 'estimate' and not public.can_manage_board(task_project) then
    raise exception 'Only managers can edit task estimate'
      using errcode = '42501';
  end if;

  update public.tasks as t
  set
    title = case
      when patch ? 'title' then nullif(btrim(patch ->> 'title'), '')
      else t.title
    end,
    description = case
      when patch ? 'description' then patch ->> 'description'
      else t.description
    end,
    priority = case
      when patch ? 'priority' then patch ->> 'priority'
      else t.priority
    end,
    deadline = case
      when patch ? 'deadline' then nullif(patch ->> 'deadline', '')::timestamptz
      else t.deadline
    end,
    linked_commit_sha = case
      when patch ? 'linked_commit_sha' then nullif(btrim(patch ->> 'linked_commit_sha'), '')
      else t.linked_commit_sha
    end,
    task_type = case
      when patch ? 'task_type' then (patch ->> 'task_type')::public.task_type
      else t.task_type
    end,
    epic_id = case
      when patch ? 'epic_id' then nullif(patch ->> 'epic_id', '')::uuid
      else t.epic_id
    end,
    epic_color = case
      when patch ? 'epic_color' then nullif(patch ->> 'epic_color', '')
      else t.epic_color
    end,
    assignee_id = case
      when patch ? 'assignee_id' then nullif(patch ->> 'assignee_id', '')::uuid
      else t.assignee_id
    end,
    author_id = case
      when patch ? 'author_id' then nullif(patch ->> 'author_id', '')::uuid
      else t.author_id
    end,
    status = case
      when patch ? 'status' then patch ->> 'status'
      else t.status
    end,
    position = case
      when patch ? 'position' then (patch ->> 'position')::integer
      else t.position
    end,
    board_id = case
      when patch ? 'board_id' then (patch ->> 'board_id')::uuid
      else t.board_id
    end,
    estimate = case
      when patch ? 'estimate' then
        case
          when patch ->> 'estimate' is null or patch ->> 'estimate' = '' then null
          else (patch ->> 'estimate')::integer
        end
      else t.estimate
    end
  where t.id = p_task_id;

  if patch ?| array['branch_name', 'pr_number', 'pr_state', 'pr_url'] then
    v_repository_id := nullif(patch ->> 'repository_id', '')::uuid;

    if v_repository_id is null then
      select count(*)::integer, (array_agg(r.id))[1]
      into v_repo_count, v_repository_id
      from public.project_repositories as r
      where r.project_id = task_project;

      if v_repo_count <> 1 then
        raise exception 'repository_id is required when the Project has % Repositories', v_repo_count
          using errcode = '22023';
      end if;
    end if;

    select * into v_link
    from public.task_git_links as l
    where l.task_id = p_task_id
      and l.repository_id = v_repository_id;

    v_branch := case when patch ? 'branch_name'
      then nullif(btrim(patch ->> 'branch_name'), '') else v_link.branch_name end;
    v_pr_number := case when patch ? 'pr_number'
      then nullif(patch ->> 'pr_number', '')::integer else v_link.pr_number end;
    v_pr_state := case when patch ? 'pr_state'
      then nullif(patch ->> 'pr_state', '') else v_link.pr_state end;
    v_pr_url := case when patch ? 'pr_url'
      then nullif(patch ->> 'pr_url', '') else v_link.pr_url end;

    if v_branch is null and v_pr_number is null then
      delete from public.task_git_links as l
      where l.task_id = p_task_id
        and l.repository_id = v_repository_id;
    else
      insert into public.task_git_links (
        task_id, repository_id, project_id, branch_name, pr_number, pr_state, pr_url
      )
      values (
        p_task_id, v_repository_id, task_project, v_branch, v_pr_number, v_pr_state, v_pr_url
      )
      on conflict (task_id, repository_id) do update
      set
        branch_name = excluded.branch_name,
        pr_number = excluded.pr_number,
        pr_state = excluded.pr_state,
        pr_url = excluded.pr_url;
    end if;
  end if;

  if p_label_ids is null then
    return;
  end if;

  label_ids := coalesce(p_label_ids, '{}'::uuid[]);

  select count(*)::integer into distinct_count
  from (
    select distinct unnest(label_ids) as id
  ) as distinct_ids;

  if distinct_count <> coalesce(cardinality(label_ids), 0) then
    raise exception 'Label id list contains duplicates'
      using errcode = 'P0001';
  end if;

  select count(*)::integer into matched_count
  from unnest(label_ids) as lid(id)
  inner join public.labels as l
    on l.id = lid.id
    and l.project_id = task_project;

  if matched_count <> distinct_count then
    raise exception 'Label id list contains unknown labels'
      using errcode = 'P0001';
  end if;

  delete from public.task_labels
  where task_id = p_task_id;

  insert into public.task_labels (task_id, label_id)
  select p_task_id, lid.id
  from unnest(label_ids) as lid(id);
end;
$$;

revoke all on function public.update_task_details(uuid, jsonb, uuid[]) from public, anon;
grant execute on function public.update_task_details(uuid, jsonb, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Realtime: Git link changes refresh the Board wherever tasks already
--    stream (the webhook now writes task_git_links, not tasks).
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_git_links'
  ) then
    alter publication supabase_realtime add table public.task_git_links;
  end if;
exception
  when undefined_object then
    null;
end;
$$;
