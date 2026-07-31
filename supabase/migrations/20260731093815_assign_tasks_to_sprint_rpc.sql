-- Atomic bulk sprint membership updates (assign + reorder positions).

create or replace function public.assign_tasks_to_sprint(p_updates jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  v_task_id uuid;
  v_sprint_id uuid;
  v_sprint_position integer;
  v_task_project uuid;
  v_set_sprint_id boolean;
begin
  if p_updates is null or jsonb_typeof(p_updates) <> 'array' then
    raise exception 'p_updates must be a JSON array'
      using errcode = 'P0001';
  end if;

  for item in select * from jsonb_array_elements(p_updates)
  loop
    v_task_id := (item ->> 'taskId')::uuid;
    v_set_sprint_id := item ? 'sprintId';
    v_sprint_id := nullif(item ->> 'sprintId', '')::uuid;
    v_sprint_position := nullif(item ->> 'sprintPosition', '')::integer;

    if v_task_id is null then
      raise exception 'Each update requires taskId'
        using errcode = 'P0001';
    end if;

    select t.project_id into v_task_project
    from public.tasks as t
    where t.id = v_task_id;

    if v_task_project is null then
      raise exception 'Task not found'
        using errcode = 'P0002';
    end if;

    if not public.can_edit_tasks(v_task_project) then
      raise exception 'Only editors can assign tasks to sprints'
        using errcode = '42501';
    end if;

    if v_set_sprint_id then
      update public.tasks as t
      set
        sprint_id = v_sprint_id,
        sprint_position = v_sprint_position
      where t.id = v_task_id;
    else
      update public.tasks as t
      set sprint_position = v_sprint_position
      where t.id = v_task_id;
    end if;
  end loop;
end;
$$;

revoke all on function public.assign_tasks_to_sprint(jsonb) from public;
grant execute on function public.assign_tasks_to_sprint(jsonb) to authenticated;
