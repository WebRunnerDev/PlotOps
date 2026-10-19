-- Epics (ADR 0031): an Epic is a Task with task_type = 'epic'.
-- Root Stories / Tasks / Bugs join an Epic via tasks.epic_id (same Project, any Board).
-- Subtasks never carry epic_id — they belong to their Parent Task's Epic.
-- Epics: no Parent Task, no Subtasks, no Sprint, no Estimate; optional epic_color.

-- ---------------------------------------------------------------------------
-- 1. Task keys: EPIC-n / STORY-n (old FEAT-n keys stay)
-- ---------------------------------------------------------------------------

create or replace function public.set_task_key()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  seq bigint;
  prefix text;
begin
  insert into public.project_task_sequences (project_id, next_val)
  values (NEW.project_id, 2)
  on conflict (project_id)
  do update set next_val = public.project_task_sequences.next_val + 1
  returning public.project_task_sequences.next_val - 1 into seq;

  prefix := case NEW.task_type
    when 'epic'  then 'EPIC'
    when 'story' then 'STORY'
    when 'bug'   then 'BUG'
    else              'TASK'
  end;

  NEW.task_key := prefix || '-' || seq;
  return NEW;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. System Description field applies to every Task type, including Epic
-- ---------------------------------------------------------------------------

create or replace function public.ensure_project_description_field(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_exists boolean;
begin
  select exists (
    select 1
    from public.custom_field_definitions as d
    where d.project_id = p_project_id
      and d.system_key = 'description'
  )
  into v_exists;

  if v_exists then
    return;
  end if;

  perform set_config('plotops.allow_system_custom_field', 'on', true);

  -- Prefer promoting an existing "Description" custom field when present.
  update public.custom_field_definitions as d
  set system_key = 'description'
  where d.id = (
    select c.id
    from public.custom_field_definitions as c
    where c.project_id = p_project_id
      and c.system_key is null
      and lower(c.name) = 'description'
    order by c.position, c.name
    limit 1
  );

  if found then
    return;
  end if;

  update public.custom_field_definitions as d
  set position = d.position + 1
  where d.project_id = p_project_id
    and d.system_key is null;

  v_name := 'Description';
  if exists (
    select 1
    from public.custom_field_definitions as d
    where d.project_id = p_project_id
      and lower(d.name) = lower(v_name)
  ) then
    v_name := 'Task description';
  end if;

  insert into public.custom_field_definitions (
    project_id,
    name,
    position,
    applies_to,
    system_key
  )
  values (
    p_project_id,
    v_name,
    0,
    array['epic', 'story', 'task', 'bug']::public.task_type[],
    'description'
  );
end;
$$;

update public.custom_field_definitions as d
set applies_to = array['epic'::public.task_type] || d.applies_to
where d.system_key = 'description'
  and not ('epic'::public.task_type = any (d.applies_to));

-- ---------------------------------------------------------------------------
-- 3. Boards never default to Epic (Epics are created deliberately, Manager+)
-- ---------------------------------------------------------------------------

update public.boards
set default_task_type = 'task'
where default_task_type = 'epic';

alter table public.boards
  drop constraint if exists boards_default_task_type_not_epic;

alter table public.boards
  add constraint boards_default_task_type_not_epic
  check (default_task_type is distinct from 'epic'::public.task_type);

-- ---------------------------------------------------------------------------
-- 4. Columns: epic_id (membership) + epic_color (badge colour on Epics)
-- ---------------------------------------------------------------------------

alter table public.tasks
  add column if not exists epic_id uuid;

alter table public.tasks
  add column if not exists epic_color text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_epic_id_fkey'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_epic_id_fkey
      foreign key (epic_id) references public.tasks (id)
      on delete set null;
  end if;
end $$;

alter table public.tasks
  drop constraint if exists tasks_epic_not_self;

alter table public.tasks
  add constraint tasks_epic_not_self
  check (epic_id is distinct from id);

alter table public.tasks
  drop constraint if exists tasks_epic_color_known;

alter table public.tasks
  add constraint tasks_epic_color_known
  check (
    epic_color is null
    or epic_color in (
      'purple', 'blue', 'teal', 'green', 'yellow',
      'orange', 'red', 'pink', 'gray'
    )
  );

create index if not exists tasks_epic_id_idx
  on public.tasks (epic_id)
  where epic_id is not null;

create index if not exists tasks_project_epics_idx
  on public.tasks (project_id)
  where task_type = 'epic';

-- ---------------------------------------------------------------------------
-- 5. Hierarchy rules for Epics
-- ---------------------------------------------------------------------------

create or replace function public.assert_task_epic_rules()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_epic public.tasks%rowtype;
  v_parent_type public.task_type;
  v_type_changed boolean :=
    tg_op = 'UPDATE' and new.task_type is distinct from old.task_type;
  v_epic_changed boolean :=
    tg_op = 'INSERT' or new.epic_id is distinct from old.epic_id;
  v_parent_changed boolean :=
    tg_op = 'INSERT' or new.parent_id is distinct from old.parent_id;
begin
  -- Archived Tasks: Epic membership may only be cleared (FK set null on Epic delete).
  if tg_op = 'UPDATE'
     and old.archived_at is not null
     and new.archived_at is not null
     and (
       new.epic_color is distinct from old.epic_color
       or (v_epic_changed and new.epic_id is not null)
     ) then
    raise exception 'Task is archived and cannot be modified'
      using errcode = 'P0001';
  end if;

  -- Converting to / from Epic is Manager+ (root Epic insert is Manager+ via RLS).
  if v_type_changed
     and (new.task_type = 'epic' or old.task_type = 'epic')
     and not public.can_create_tasks(new.project_id) then
    raise exception 'Only managers can create or convert Epics'
      using errcode = '42501';
  end if;

  if new.task_type = 'epic' then
    if new.parent_id is not null then
      raise exception 'An Epic cannot be a Subtask'
        using errcode = 'P0001';
    end if;

    if new.sprint_id is not null then
      raise exception 'An Epic cannot join a Sprint'
        using errcode = 'P0001';
    end if;

    if new.epic_id is not null then
      if v_type_changed and not v_epic_changed then
        -- A Story promoted to Epic leaves its former Epic.
        new.epic_id := null;
      else
        raise exception 'An Epic cannot belong to an Epic'
          using errcode = 'P0001';
      end if;
    end if;

    if v_type_changed
       and exists (
         select 1
         from public.tasks as child
         where child.parent_id = new.id
       ) then
      raise exception 'A Parent Task cannot become an Epic'
        using errcode = 'P0001';
    end if;

    -- Epic size is the rollup of its Tasks, never its own Estimate.
    new.estimate := null;
    return new;
  end if;

  new.epic_color := null;

  if v_type_changed
     and old.task_type = 'epic'
     and exists (
       select 1
       from public.tasks as member
       where member.epic_id = new.id
     ) then
    raise exception 'An Epic with Tasks cannot change type'
      using errcode = 'P0001';
  end if;

  if new.parent_id is not null and v_parent_changed then
    select t.task_type
      into v_parent_type
    from public.tasks as t
    where t.id = new.parent_id;

    if v_parent_type = 'epic' then
      raise exception 'An Epic cannot have Subtasks'
        using errcode = 'P0001';
    end if;
  end if;

  if new.parent_id is not null and new.epic_id is not null then
    if v_parent_changed and not v_epic_changed then
      -- Becoming a Subtask: Epic membership now comes from the Parent Task.
      new.epic_id := null;
    else
      raise exception 'A Subtask belongs to its Parent Task''s Epic'
        using errcode = 'P0001';
    end if;
  end if;

  if new.epic_id is null or not v_epic_changed then
    return new;
  end if;

  select *
    into v_epic
  from public.tasks as t
  where t.id = new.epic_id;

  if not found then
    raise exception 'Epic not found'
      using errcode = 'P0002';
  end if;

  if v_epic.task_type <> 'epic' then
    raise exception 'Target Task is not an Epic'
      using errcode = 'P0001';
  end if;

  if v_epic.project_id <> new.project_id then
    raise exception 'Epic and Task must be in the same Project'
      using errcode = 'P0001';
  end if;

  if v_epic.archived_at is not null then
    raise exception 'Archived Epics cannot receive Tasks'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_epic_rules on public.tasks;
create trigger tasks_epic_rules
  before insert or update of task_type, epic_id, epic_color, parent_id, sprint_id, estimate
  on public.tasks
  for each row
  execute function public.assert_task_epic_rules();

revoke all on function public.assert_task_epic_rules() from public;

-- ---------------------------------------------------------------------------
-- 6. update_task_details: epic_id + epic_color patch keys
-- ---------------------------------------------------------------------------

create or replace function public.update_task_details(
  p_task_id uuid,
  p_patch jsonb default '{}'::jsonb,
  p_label_ids uuid[] default null::uuid[]
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
    branch_name = case
      when patch ? 'branch_name' then patch ->> 'branch_name'
      else t.branch_name
    end,
    linked_commit_sha = case
      when patch ? 'linked_commit_sha' then nullif(btrim(patch ->> 'linked_commit_sha'), '')
      else t.linked_commit_sha
    end,
    pr_number = case
      when patch ? 'pr_number' then nullif(patch ->> 'pr_number', '')::integer
      else t.pr_number
    end,
    pr_state = case
      when patch ? 'pr_state' then patch ->> 'pr_state'
      else t.pr_state
    end,
    pr_url = case
      when patch ? 'pr_url' then patch ->> 'pr_url'
      else t.pr_url
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

-- ---------------------------------------------------------------------------
-- 7. project_epics: every Epic in a Project with progress over its Tasks
--    Done = Task sits in its Board's is_done column (same rule as Parent gates).
-- ---------------------------------------------------------------------------

create or replace function public.project_epics(p_project_id uuid)
returns table (
  id uuid,
  task_key text,
  title text,
  epic_color text,
  board_id uuid,
  status text,
  archived_at timestamptz,
  created_at timestamptz,
  is_done boolean,
  task_count integer,
  done_count integer,
  points_total integer,
  points_done integer,
  unestimated_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    e.id,
    e.task_key,
    e.title,
    e.epic_color,
    e.board_id,
    e.status,
    e.archived_at,
    e.created_at,
    coalesce(bool_or(epic_col.is_done), false) as is_done,
    count(member.id)::integer as task_count,
    count(member.id) filter (
      where coalesce(member_col.is_done, false)
    )::integer as done_count,
    coalesce(sum(member.estimate), 0)::integer as points_total,
    coalesce(sum(member.estimate) filter (
      where coalesce(member_col.is_done, false)
    ), 0)::integer as points_done,
    count(member.id) filter (
      where member.estimate is null
    )::integer as unestimated_count
  from public.tasks as e
  left join public.board_columns as epic_col
    on epic_col.board_id = e.board_id
   and epic_col.id = e.status
  left join public.tasks as member
    on member.epic_id = e.id
   and member.archived_at is null
  left join public.board_columns as member_col
    on member_col.board_id = member.board_id
   and member_col.id = member.status
  where e.project_id = p_project_id
    and e.task_type = 'epic'
  group by e.id
  order by e.created_at, e.id;
$$;

revoke all on function public.project_epics(uuid) from public;
revoke all on function public.project_epics(uuid) from anon;
grant execute on function public.project_epics(uuid) to authenticated;

notify pgrst, 'reload schema';
