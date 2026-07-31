-- Atomic task label replace: delete + insert in one transaction.
-- Replaces client delete-then-insert that could wipe labels if insert fails.

create or replace function public.replace_task_labels(
  p_task_id uuid,
  p_label_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  task_project uuid;
  label_ids uuid[] := coalesce(p_label_ids, '{}'::uuid[]);
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
    raise exception 'Only editors can replace task labels'
      using errcode = '42501';
  end if;

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

revoke all on function public.replace_task_labels(uuid, uuid[]) from public;
grant execute on function public.replace_task_labels(uuid, uuid[]) to authenticated;
