-- Optional Fibonacci story points on Tasks (wave 3.3).
-- null = unestimated. Manager+ may set/clear; Contributors may not.

alter table public.tasks
  add column if not exists estimate integer null;

comment on column public.tasks.estimate is
  'Optional Fibonacci story points (1,2,3,5,8,13,21). null = unestimated. Manager+ edit only.';

alter table public.tasks
  drop constraint if exists tasks_estimate_fibonacci_chk;

alter table public.tasks
  add constraint tasks_estimate_fibonacci_chk
  check (
    estimate is null
    or estimate in (1, 2, 3, 5, 8, 13, 21)
  );

-- Block Contributor (and weaker) from changing estimate via direct UPDATE.
create or replace function public.enforce_task_estimate_manager()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.estimate is not distinct from old.estimate then
    return new;
  end if;

  if not public.can_manage_board(new.project_id) then
    raise exception 'Only managers can edit task estimate'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_estimate_manager_guard on public.tasks;
create trigger tasks_estimate_manager_guard
  before update of estimate on public.tasks
  for each row
  execute function public.enforce_task_estimate_manager();

-- update_task_details: accept estimate + Manager+ gate when present in patch.
create or replace function public.update_task_details(
  p_task_id uuid,
  p_patch jsonb default '{}'::jsonb,
  p_label_ids uuid[] default null
)
returns void
language plpgsql
security invoker
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

revoke all on function public.update_task_details(uuid, jsonb, uuid[]) from public;
grant execute on function public.update_task_details(uuid, jsonb, uuid[]) to authenticated;
