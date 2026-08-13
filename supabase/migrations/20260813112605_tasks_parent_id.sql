-- Subtask as a full Task: nullable parent_id, one hierarchy level, same Project.
-- Create Subtask: Contributor+ (can_edit_tasks). Root insert stays can_create_tasks.
-- Clear parent (Subtask → root): Manager+ (can_create_tasks).

alter table public.tasks
  add column if not exists parent_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_parent_id_fkey'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_parent_id_fkey
      foreign key (parent_id) references public.tasks (id)
      on delete restrict;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_parent_not_self'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_parent_not_self
      check (parent_id is distinct from id);
  end if;
end $$;

create index if not exists tasks_parent_id_idx
  on public.tasks (parent_id)
  where parent_id is not null;

drop policy if exists "tasks_insert_managers" on public.tasks;
create policy "tasks_insert_managers"
  on public.tasks
  for insert
  to authenticated
  with check (
    parent_id is null
    and public.can_create_tasks(project_id)
  );

drop policy if exists "tasks_insert_subtasks" on public.tasks;
create policy "tasks_insert_subtasks"
  on public.tasks
  for insert
  to authenticated
  with check (
    parent_id is not null
    and public.can_edit_tasks(project_id)
  );

-- Subtask insert still allocates task_key via project_task_sequences.
drop policy if exists "pts_task_creators" on public.project_task_sequences;
create policy "pts_task_creators"
  on public.project_task_sequences
  for all
  to authenticated
  using (public.can_edit_tasks(project_id))
  with check (public.can_edit_tasks(project_id));

create or replace function public.assert_task_parent_legal()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_parent public.tasks%rowtype;
begin
  if tg_op = 'UPDATE'
    and old.parent_id is not distinct from new.parent_id then
    return new;
  end if;

  if new.parent_id is null then
    if tg_op = 'UPDATE'
      and old.parent_id is not null
      and not public.can_create_tasks(new.project_id) then
      raise exception 'Only managers can turn a Subtask into a root Task'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'A Task cannot be a Subtask of itself'
      using errcode = 'P0001';
  end if;

  select *
    into v_parent
  from public.tasks as t
  where t.id = new.parent_id;

  if not found then
    raise exception 'Parent Task not found'
      using errcode = 'P0002';
  end if;

  if v_parent.project_id <> new.project_id then
    raise exception 'Parent Task and Subtask must be in the same Project'
      using errcode = 'P0001';
  end if;

  if v_parent.parent_id is not null then
    raise exception 'A Subtask cannot have Subtasks'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.tasks as child
    where child.parent_id = new.id
      and child.id is distinct from new.id
  ) then
    raise exception 'A Parent Task cannot become a Subtask'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_parent_legal on public.tasks;
create trigger tasks_parent_legal
  before insert or update of parent_id
  on public.tasks
  for each row
  execute function public.assert_task_parent_legal();

revoke all on function public.assert_task_parent_legal() from public;

create or replace function public.create_subtask(
  p_parent_id uuid,
  p_title text,
  p_task_type public.task_type default null,
  p_sprint_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_parent public.tasks%rowtype;
  v_status text;
  v_task_type public.task_type;
  v_position integer;
  v_sprint_position integer;
  v_id uuid;
  v_key text;
begin
  select *
    into v_parent
  from public.tasks as t
  where t.id = p_parent_id
    and t.archived_at is null;

  if not found then
    raise exception 'Parent Task not found'
      using errcode = 'P0002';
  end if;

  if not public.can_edit_tasks(v_parent.project_id) then
    raise exception 'Only editors can create a Subtask'
      using errcode = '42501';
  end if;

  if v_parent.parent_id is not null then
    raise exception 'A Subtask cannot have Subtasks'
      using errcode = 'P0001';
  end if;

  select bc.id
    into v_status
  from public.board_columns as bc
  where bc.board_id = v_parent.board_id
  order by bc.position
  limit 1;

  if v_status is null then
    raise exception 'Board has no columns'
      using errcode = 'P0001';
  end if;

  v_task_type := coalesce(p_task_type, 'task'::public.task_type);

  select coalesce(max(t.position), -1) + 1
    into v_position
  from public.tasks as t
  where t.board_id = v_parent.board_id
    and t.status = v_status
    and t.archived_at is null;

  if p_sprint_id is not null then
    select coalesce(max(t.sprint_position), -1) + 1
      into v_sprint_position
    from public.tasks as t
    where t.sprint_id = p_sprint_id
      and t.archived_at is null;
  end if;

  insert into public.tasks (
    author_id,
    board_id,
    parent_id,
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
    (select auth.uid()),
    v_parent.board_id,
    v_parent.id,
    v_position,
    'medium',
    v_parent.project_id,
    p_sprint_id,
    v_sprint_position,
    v_status,
    v_task_type,
    btrim(p_title)
  )
  returning id, task_key into v_id, v_key;

  insert into public.activity_log (
    task_id,
    project_id,
    user_id,
    action,
    metadata
  )
  values
    (
      v_parent.id,
      v_parent.project_id,
      (select auth.uid()),
      'updated',
      jsonb_build_object(
        'changes',
        jsonb_build_array(
          jsonb_build_object(
            'field', 'subtask',
            'from', null,
            'to', jsonb_build_object('key', v_key)
          )
        )
      )
    ),
    (
      v_id,
      v_parent.project_id,
      (select auth.uid()),
      'updated',
      jsonb_build_object(
        'changes',
        jsonb_build_array(
          jsonb_build_object(
            'field', 'parent',
            'from', null,
            'to', jsonb_build_object('key', v_parent.task_key)
          )
        )
      )
    );

  return v_id;
end;
$$;

create or replace function public.clear_task_parent(p_task_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_child public.tasks%rowtype;
  v_parent public.tasks%rowtype;
begin
  select *
    into v_child
  from public.tasks as t
  where t.id = p_task_id;

  if not found then
    raise exception 'Task not found'
      using errcode = 'P0002';
  end if;

  if v_child.parent_id is null then
    return;
  end if;

  if not public.can_create_tasks(v_child.project_id) then
    raise exception 'Only managers can turn a Subtask into a root Task'
      using errcode = '42501';
  end if;

  select *
    into v_parent
  from public.tasks as t
  where t.id = v_child.parent_id;

  update public.tasks as t
  set parent_id = null
  where t.id = v_child.id;

  insert into public.activity_log (
    task_id,
    project_id,
    user_id,
    action,
    metadata
  )
  values (
    v_child.id,
    v_child.project_id,
    (select auth.uid()),
    'updated',
    jsonb_build_object(
      'changes',
      jsonb_build_array(
        jsonb_build_object(
          'field', 'parent',
          'from', case
            when v_parent.id is null then null
            else jsonb_build_object('key', v_parent.task_key)
          end,
          'to', null
        )
      )
    )
  );

  if v_parent.id is not null then
    insert into public.activity_log (
      task_id,
      project_id,
      user_id,
      action,
      metadata
    )
    values (
      v_parent.id,
      v_parent.project_id,
      (select auth.uid()),
      'updated',
      jsonb_build_object(
        'changes',
        jsonb_build_array(
          jsonb_build_object(
            'field', 'subtask',
            'from', jsonb_build_object('key', v_child.task_key),
            'to', null
          )
        )
      )
    );
  end if;
end;
$$;

revoke all on function public.create_subtask(uuid, text, public.task_type, uuid) from public;
grant execute on function public.create_subtask(uuid, text, public.task_type, uuid) to authenticated;

revoke all on function public.clear_task_parent(uuid) from public;
grant execute on function public.clear_task_parent(uuid) to authenticated;

notify pgrst, 'reload schema';
