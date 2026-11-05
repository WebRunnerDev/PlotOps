-- MCP server (Cloudflare Worker) shares Task writes with the SPA.
-- create_task / change_task_status / add_task_comment are security invoker
-- so existing RLS still applies. The Worker uses the user's access token and
-- the publishable key — never the service role.
--
-- Also: editors could previously PATCH any tasks column via PostgREST
-- (RLS only checks can_edit_tasks). Lock system columns and GRANT UPDATE
-- on a whitelist.

-- ---------------------------------------------------------------------------
-- 1. Harden tasks UPDATE: system columns + column-level GRANT
-- ---------------------------------------------------------------------------

create or replace function public.tasks_protect_system_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.project_id is distinct from old.project_id
     or new.task_key is distinct from old.task_key
     or new.created_at is distinct from old.created_at then
    raise exception 'System task columns cannot be updated'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_protect_system_columns on public.tasks;

create trigger tasks_protect_system_columns
  before update on public.tasks
  for each row
  execute function public.tasks_protect_system_columns();

revoke all on function public.tasks_protect_system_columns() from public;
revoke all on function public.tasks_protect_system_columns() from anon;
revoke all on function public.tasks_protect_system_columns() from authenticated;

revoke update on public.tasks from authenticated;

grant update (
  archived_at,
  archived_by,
  assignee_id,
  author_id,
  board_id,
  branch_name,
  deadline,
  description,
  epic_color,
  epic_id,
  estimate,
  linked_commit_sha,
  parent_id,
  position,
  pr_number,
  pr_state,
  pr_url,
  priority,
  sprint_id,
  sprint_position,
  status,
  task_type,
  title
) on public.tasks to authenticated;

-- ---------------------------------------------------------------------------
-- 2. create_task — position, default type, auto-assign, author = auth.uid()
-- ---------------------------------------------------------------------------

create or replace function public.create_task(
  p_board_id uuid,
  p_title text,
  p_options jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  options jsonb := coalesce(p_options, '{}'::jsonb);
  v_board public.boards%rowtype;
  v_title text;
  v_status text;
  v_task_type public.task_type;
  v_priority text;
  v_assignee uuid;
  v_auto_assign boolean;
  v_people integer;
  v_sprint_id uuid;
  v_sprint_position integer;
  v_position integer;
  v_description text;
  v_epic_id uuid;
  v_epic_color text;
  v_id uuid;
begin
  v_title := btrim(coalesce(p_title, ''));
  if v_title = '' then
    raise exception 'Task title is required'
      using errcode = 'P0001';
  end if;
  if char_length(v_title) > 255 then
    raise exception 'Task title must be at most 255 characters'
      using errcode = 'P0001';
  end if;

  select *
    into v_board
  from public.boards as b
  where b.id = p_board_id;

  if not found then
    raise exception 'Board not found'
      using errcode = 'P0002';
  end if;

  if options ? 'project_id'
     and nullif(btrim(options ->> 'project_id'), '') is not null
     and v_board.project_id <> (options ->> 'project_id')::uuid then
    raise exception 'Board does not belong to project'
      using errcode = 'P0001';
  end if;

  if not public.can_create_tasks(v_board.project_id) then
    raise exception 'Only managers can create tasks'
      using errcode = '42501';
  end if;

  if options ? 'status' then
    v_status := nullif(btrim(options ->> 'status'), '');
  end if;

  if v_status is null then
    select bc.id
      into v_status
    from public.board_columns as bc
    where bc.board_id = p_board_id
    order by bc.position
    limit 1;
  else
    if not exists (
      select 1
      from public.board_columns as bc
      where bc.board_id = p_board_id
        and bc.id = v_status
    ) then
      raise exception 'Column is not on this board'
        using errcode = 'P0001';
    end if;
  end if;

  if v_status is null then
    raise exception 'Board has no columns'
      using errcode = 'P0001';
  end if;

  if options ? 'task_type' and nullif(btrim(options ->> 'task_type'), '') is not null then
    v_task_type := (options ->> 'task_type')::public.task_type;
  elsif v_board.default_task_type in ('bug', 'story', 'task') then
    v_task_type := v_board.default_task_type::public.task_type;
  else
    v_task_type := 'task'::public.task_type;
  end if;

  if options ? 'priority' then
    v_priority := nullif(btrim(options ->> 'priority'), '');
  else
    v_priority := 'medium';
  end if;

  if options ? 'assignee_id' then
    v_assignee := nullif(btrim(options ->> 'assignee_id'), '')::uuid;
  else
    v_auto_assign := coalesce(v_board.auto_assign_to_creator, false);
    if v_auto_assign then
      select
        (case when t.owner_id is not null then 1 else 0 end)
        + (
          select count(*)::integer
          from public.team_members as m
          where m.team_id = t.id
        )
        into v_people
      from public.teams as t
      where t.id = public.project_team_id(v_board.project_id);

      if v_people = 1 then
        v_assignee := (select auth.uid());
      end if;
    end if;
  end if;

  if options ? 'sprint_id' and nullif(btrim(options ->> 'sprint_id'), '') is not null then
    v_sprint_id := (options ->> 'sprint_id')::uuid;
    if not exists (
      select 1
      from public.sprints as s
      where s.id = v_sprint_id
        and s.board_id = p_board_id
        and s.state in ('draft', 'active')
    ) then
      raise exception 'Sprint is not an open sprint on this board'
        using errcode = 'P0001';
    end if;

    select coalesce(max(t.sprint_position), -1) + 1
      into v_sprint_position
    from public.tasks as t
    where t.sprint_id = v_sprint_id
      and t.archived_at is null;
  end if;

  if options ? 'description' then
    v_description := options ->> 'description';
    if v_description is not null and char_length(v_description) > 131072 then
      raise exception 'Task description is too long'
        using errcode = 'P0001';
    end if;
  end if;

  if v_task_type = 'epic' then
    if options ? 'epic_color' then
      v_epic_color := nullif(btrim(options ->> 'epic_color'), '');
    end if;
  elsif options ? 'epic_id' then
    v_epic_id := nullif(btrim(options ->> 'epic_id'), '')::uuid;
  end if;

  select coalesce(max(t.position), -1) + 1
    into v_position
  from public.tasks as t
  where t.board_id = p_board_id
    and t.status = v_status
    and t.archived_at is null;

  insert into public.tasks (
    assignee_id,
    author_id,
    board_id,
    description,
    epic_color,
    epic_id,
    position,
    priority,
    project_id,
    sprint_id,
    sprint_position,
    status,
    task_type,
    title
  )
  values (
    v_assignee,
    (select auth.uid()),
    p_board_id,
    v_description,
    v_epic_color,
    v_epic_id,
    v_position,
    v_priority,
    v_board.project_id,
    v_sprint_id,
    v_sprint_position,
    v_status,
    v_task_type,
    v_title
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_task(uuid, text, jsonb) from public;
revoke all on function public.create_task(uuid, text, jsonb) from anon;
grant execute on function public.create_task(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. change_task_status — append to a column via persist_task_moves
-- ---------------------------------------------------------------------------

create or replace function public.change_task_status(
  p_task_id uuid,
  p_column_id text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_board_id uuid;
  v_archived timestamptz;
  v_position integer;
  v_column text := nullif(btrim(coalesce(p_column_id, '')), '');
begin
  if v_column is null then
    raise exception 'Column id is required'
      using errcode = 'P0001';
  end if;

  select t.board_id, t.archived_at
    into v_board_id, v_archived
  from public.tasks as t
  where t.id = p_task_id;

  if v_board_id is null then
    raise exception 'Task not found'
      using errcode = 'P0002';
  end if;

  if v_archived is not null then
    raise exception 'Task is archived and cannot be modified'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.board_columns as bc
    where bc.board_id = v_board_id
      and bc.id = v_column
  ) then
    raise exception 'Column is not on this board'
      using errcode = 'P0001';
  end if;

  select coalesce(max(t.position), -1) + 1
    into v_position
  from public.tasks as t
  where t.board_id = v_board_id
    and t.status = v_column
    and t.archived_at is null
    and t.id <> p_task_id;

  perform public.persist_task_moves(
    v_board_id,
    jsonb_build_array(
      jsonb_build_object(
        'id', p_task_id,
        'position', v_position,
        'status', v_column
      )
    )
  );
end;
$$;

revoke all on function public.change_task_status(uuid, text) from public;
revoke all on function public.change_task_status(uuid, text) from anon;
grant execute on function public.change_task_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. add_task_comment — author is always the caller
-- ---------------------------------------------------------------------------

create or replace function public.add_task_comment(
  p_task_id uuid,
  p_body text,
  p_parent_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project uuid;
  v_archived timestamptz;
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if v_body = '' then
    raise exception 'Comment body is required'
      using errcode = 'P0001';
  end if;
  if char_length(v_body) > 32768 then
    raise exception 'Comment body is too long'
      using errcode = 'P0001';
  end if;

  select t.project_id, t.archived_at
    into v_project, v_archived
  from public.tasks as t
  where t.id = p_task_id;

  if v_project is null then
    raise exception 'Task not found'
      using errcode = 'P0002';
  end if;

  if v_archived is not null then
    raise exception 'Task is archived and cannot be modified'
      using errcode = 'P0001';
  end if;

  if not public.can_edit_tasks(v_project) then
    raise exception 'Only editors can comment on tasks'
      using errcode = '42501';
  end if;

  insert into public.task_comments (
    author_id,
    body,
    parent_id,
    project_id,
    task_id
  )
  values (
    (select auth.uid()),
    v_body,
    p_parent_id,
    v_project,
    p_task_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.add_task_comment(uuid, text, uuid) from public;
revoke all on function public.add_task_comment(uuid, text, uuid) from anon;
grant execute on function public.add_task_comment(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. mcp_action_log + rate-limit claim (authenticated, own rows only)
-- ---------------------------------------------------------------------------

create table if not exists public.mcp_action_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id text,
  tool_name text not null,
  resource_type text,
  resource_id uuid,
  success boolean not null default true,
  error_code text,
  created_at timestamptz not null default now(),
  constraint mcp_action_log_tool_name_length
    check (char_length(tool_name) between 1 and 64),
  constraint mcp_action_log_client_id_length
    check (client_id is null or char_length(client_id) between 1 and 128),
  constraint mcp_action_log_resource_type_length
    check (resource_type is null or char_length(resource_type) between 1 and 32),
  constraint mcp_action_log_error_code_length
    check (error_code is null or char_length(error_code) between 1 and 64)
);

create index if not exists mcp_action_log_user_created_idx
  on public.mcp_action_log (user_id, created_at desc);

alter table public.mcp_action_log enable row level security;

drop policy if exists "mcp_action_log_insert_own" on public.mcp_action_log;
create policy "mcp_action_log_insert_own"
  on public.mcp_action_log
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "mcp_action_log_select_own" on public.mcp_action_log;
create policy "mcp_action_log_select_own"
  on public.mcp_action_log
  for select
  to authenticated
  using (user_id = (select auth.uid()));

grant select, insert on public.mcp_action_log to authenticated;

create or replace function public.log_mcp_action(
  p_tool_name text,
  p_success boolean default true,
  p_client_id text default null,
  p_resource_type text default null,
  p_resource_id uuid default null,
  p_error_code text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.mcp_action_log (
    client_id,
    error_code,
    resource_id,
    resource_type,
    success,
    tool_name,
    user_id
  )
  values (
    nullif(btrim(coalesce(p_client_id, '')), ''),
    nullif(btrim(coalesce(p_error_code, '')), ''),
    p_resource_id,
    nullif(btrim(coalesce(p_resource_type, '')), ''),
    coalesce(p_success, true),
    btrim(p_tool_name),
    (select auth.uid())
  );
end;
$$;

revoke all on function public.log_mcp_action(text, boolean, text, text, uuid, text) from public;
revoke all on function public.log_mcp_action(text, boolean, text, text, uuid, text) from anon;
grant execute on function public.log_mcp_action(text, boolean, text, text, uuid, text) to authenticated;

create or replace function public.claim_mcp_rate_limit(
  p_limit integer default 60,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_limit integer := greatest(coalesce(p_limit, 60), 1);
  v_window integer := greatest(coalesce(p_window_seconds, 60), 1);
  v_count integer;
begin
  if v_uid is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select count(*)::integer
    into v_count
  from public.mcp_action_log as l
  where l.user_id = v_uid
    and l.created_at > now() - make_interval(secs => v_window);

  return v_count < v_limit;
end;
$$;

revoke all on function public.claim_mcp_rate_limit(integer, integer) from public;
revoke all on function public.claim_mcp_rate_limit(integer, integer) from anon;
grant execute on function public.claim_mcp_rate_limit(integer, integer) to authenticated;

notify pgrst, 'reload schema';
