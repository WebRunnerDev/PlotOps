-- Bulk soft-archive for board multi-select. Single round-trip + activity rows.
-- Caps at 100 ids. Authz: can_delete_tasks (same as single-task archive guard).

create or replace function public.archive_tasks(p_task_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_project_count integer;
  v_archived_ids uuid[];
  v_count integer;
begin
  if p_task_ids is null or cardinality(p_task_ids) = 0 then
    raise exception 'p_task_ids must be a non-empty array'
      using errcode = 'P0001';
  end if;

  if cardinality(p_task_ids) > 100 then
    raise exception 'Cannot archive more than 100 tasks at once'
      using errcode = 'P0001';
  end if;

  select count(distinct t.project_id)::integer
    into v_project_count
  from public.tasks as t
  where t.id = any (p_task_ids);

  if v_project_count = 0 then
    raise exception 'Task not found'
      using errcode = 'P0002';
  end if;

  if v_project_count <> 1 then
    raise exception 'All tasks must belong to the same project'
      using errcode = 'P0001';
  end if;

  select t.project_id
    into v_project_id
  from public.tasks as t
  where t.id = any (p_task_ids)
  limit 1;

  if not public.can_delete_tasks(v_project_id) then
    raise exception 'Only managers can archive tasks'
      using errcode = '42501';
  end if;

  with updated as (
    update public.tasks as t
    set archived_at = now()
    where t.id = any (p_task_ids)
      and t.archived_at is null
    returning t.id, t.project_id
  )
  select coalesce(array_agg(updated.id), '{}'::uuid[])
    into v_archived_ids
  from updated;

  v_count := coalesce(cardinality(v_archived_ids), 0);

  if v_count > 0 then
    insert into public.activity_log (
      task_id,
      project_id,
      user_id,
      action,
      metadata
    )
    select
      archived_id,
      v_project_id,
      (select auth.uid()),
      'updated',
      jsonb_build_object(
        'changes',
        jsonb_build_array(
          jsonb_build_object(
            'field', 'archived',
            'from', false,
            'to', true
          )
        )
      )
    from unnest(v_archived_ids) as archived_id;
  end if;

  return v_count;
end;
$$;

revoke all on function public.archive_tasks(uuid[]) from public;
grant execute on function public.archive_tasks(uuid[]) to authenticated;

-- activity_log was created with RLS policies but without table GRANTs for authenticated.
grant select, insert on public.activity_log to authenticated;

notify pgrst, 'reload schema';
