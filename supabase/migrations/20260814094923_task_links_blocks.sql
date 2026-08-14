-- Task Links `blocks`: directed kind, cycle rejection, Done-gate (ADR 0023).
-- Inverse "blocked by" is UI-only. No Notification fan-out.

alter table public.task_links
  drop constraint if exists task_links_kind_check;

alter table public.task_links
  add constraint task_links_kind_check
  check (kind in ('relates_to', 'blocks'));

drop index if exists public.task_links_undirected_kind_idx;

create unique index if not exists task_links_relates_to_undirected_idx
  on public.task_links (
    least(source_task_id, target_task_id),
    greatest(source_task_id, target_task_id)
  )
  where kind = 'relates_to';

create unique index if not exists task_links_directed_kind_idx
  on public.task_links (kind, source_task_id, target_task_id);

create or replace function public.blocks_link_would_cycle(
  p_source_task_id uuid,
  p_target_task_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  with recursive chain as (
    select p_target_task_id as id
    union
    select link.target_task_id
    from public.task_links as link
    inner join chain as walked
      on walked.id = link.source_task_id
    where link.kind = 'blocks'
  )
  select exists (
    select 1 from chain where id = p_source_task_id
  );
$$;

revoke all on function public.blocks_link_would_cycle(uuid, uuid) from public;
grant execute on function public.blocks_link_would_cycle(uuid, uuid) to authenticated;

create or replace function public.has_open_blocker(p_task public.tasks)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.task_links as link
    inner join public.tasks as blocker
      on blocker.id = link.source_task_id
    left join public.board_columns as col
      on col.board_id = blocker.board_id
     and col.id = blocker.status
    where link.target_task_id = p_task.id
      and link.kind = 'blocks'
      and blocker.archived_at is null
      and coalesce(col.is_done, false) is not true
  );
$$;

revoke all on function public.has_open_blocker(public.tasks) from public;
grant execute on function public.has_open_blocker(public.tasks) to authenticated;

create or replace function public.assert_task_may_enter_done(p_task_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.assert_parent_task_may_enter_done(p_task_id);

  if exists (
    select 1
    from public.task_links as link
    inner join public.tasks as blocker
      on blocker.id = link.source_task_id
    left join public.board_columns as col
      on col.board_id = blocker.board_id
     and col.id = blocker.status
    where link.target_task_id = p_task_id
      and link.kind = 'blocks'
      and blocker.archived_at is null
      and coalesce(col.is_done, false) is not true
  ) then
    raise exception 'A Task cannot enter Done while an open blocker exists'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.assert_task_may_enter_done(uuid) from public;
grant execute on function public.assert_task_may_enter_done(uuid) to authenticated;

create or replace function public.assert_task_link_legal()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source public.tasks%rowtype;
  v_target public.tasks%rowtype;
begin
  if new.source_task_id = new.target_task_id then
    raise exception 'A Task cannot relate to itself'
      using errcode = 'P0001';
  end if;

  if new.kind is distinct from 'relates_to'
     and new.kind is distinct from 'blocks' then
    raise exception 'Unknown Task Link kind'
      using errcode = 'P0001';
  end if;

  select * into v_source
  from public.tasks as t
  where t.id = new.source_task_id;

  if not found then
    raise exception 'Task not found'
      using errcode = 'P0002';
  end if;

  select * into v_target
  from public.tasks as t
  where t.id = new.target_task_id;

  if not found then
    raise exception 'Task not found'
      using errcode = 'P0002';
  end if;

  if v_source.project_id <> v_target.project_id then
    raise exception 'Task Links must stay inside the same Project'
      using errcode = 'P0001';
  end if;

  if v_source.parent_id = v_target.id
     or v_target.parent_id = v_source.id then
    raise exception 'A Task Link cannot connect a Parent Task and its own Subtask'
      using errcode = 'P0001';
  end if;

  if new.kind = 'relates_to' and exists (
    select 1
    from public.task_links as existing
    where existing.kind = 'relates_to'
      and existing.id is distinct from new.id
      and least(existing.source_task_id, existing.target_task_id)
        = least(new.source_task_id, new.target_task_id)
      and greatest(existing.source_task_id, existing.target_task_id)
        = greatest(new.source_task_id, new.target_task_id)
  ) then
    raise exception 'These Tasks are already linked'
      using errcode = 'P0001';
  end if;

  if new.kind = 'blocks' and exists (
    select 1
    from public.task_links as existing
    where existing.kind = 'blocks'
      and existing.id is distinct from new.id
      and existing.source_task_id = new.source_task_id
      and existing.target_task_id = new.target_task_id
  ) then
    raise exception 'These Tasks are already linked'
      using errcode = 'P0001';
  end if;

  if new.kind = 'blocks'
     and public.blocks_link_would_cycle(new.source_task_id, new.target_task_id) then
    raise exception 'A cyclic blocks chain is not allowed'
      using errcode = 'P0001';
  end if;

  new.project_id := v_source.project_id;
  return new;
end;
$$;

create or replace function public.create_task_link(
  p_source_task_id uuid,
  p_target_task_id uuid,
  p_kind text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source public.tasks%rowtype;
  v_target public.tasks%rowtype;
  v_id uuid;
begin
  if p_kind is distinct from 'relates_to'
     and p_kind is distinct from 'blocks' then
    raise exception 'Unknown Task Link kind'
      using errcode = 'P0001';
  end if;

  if p_source_task_id = p_target_task_id then
    raise exception 'A Task cannot relate to itself'
      using errcode = 'P0001';
  end if;

  select * into v_source
  from public.tasks as t
  where t.id = p_source_task_id;

  if not found then
    raise exception 'Task not found'
      using errcode = 'P0002';
  end if;

  select * into v_target
  from public.tasks as t
  where t.id = p_target_task_id;

  if not found then
    raise exception 'Task not found'
      using errcode = 'P0002';
  end if;

  if not public.can_edit_tasks(v_source.project_id) then
    raise exception 'Only editors can create a Task Link'
      using errcode = '42501';
  end if;

  if v_source.project_id <> v_target.project_id then
    raise exception 'Task Links must stay inside the same Project'
      using errcode = 'P0001';
  end if;

  if v_source.parent_id = v_target.id
     or v_target.parent_id = v_source.id then
    raise exception 'A Task Link cannot connect a Parent Task and its own Subtask'
      using errcode = 'P0001';
  end if;

  if p_kind = 'relates_to' and exists (
    select 1
    from public.task_links as existing
    where existing.kind = 'relates_to'
      and least(existing.source_task_id, existing.target_task_id)
        = least(p_source_task_id, p_target_task_id)
      and greatest(existing.source_task_id, existing.target_task_id)
        = greatest(p_source_task_id, p_target_task_id)
  ) then
    raise exception 'These Tasks are already linked'
      using errcode = 'P0001';
  end if;

  if p_kind = 'blocks' and exists (
    select 1
    from public.task_links as existing
    where existing.kind = 'blocks'
      and existing.source_task_id = p_source_task_id
      and existing.target_task_id = p_target_task_id
  ) then
    raise exception 'These Tasks are already linked'
      using errcode = 'P0001';
  end if;

  if p_kind = 'blocks'
     and public.blocks_link_would_cycle(p_source_task_id, p_target_task_id) then
    raise exception 'A cyclic blocks chain is not allowed'
      using errcode = 'P0001';
  end if;

  insert into public.task_links (
    created_by,
    kind,
    project_id,
    source_task_id,
    target_task_id
  )
  values (
    (select auth.uid()),
    p_kind,
    v_source.project_id,
    p_source_task_id,
    p_target_task_id
  )
  returning id into v_id;

  insert into public.activity_log (
    task_id,
    project_id,
    user_id,
    action,
    metadata
  )
  values
    (
      v_source.id,
      v_source.project_id,
      (select auth.uid()),
      'updated',
      jsonb_build_object(
        'changes',
        jsonb_build_array(
          jsonb_build_object(
            'field', 'task_link',
            'from', null,
            'to', jsonb_build_object('key', v_target.task_key, 'kind', p_kind)
          )
        )
      )
    ),
    (
      v_target.id,
      v_target.project_id,
      (select auth.uid()),
      'updated',
      jsonb_build_object(
        'changes',
        jsonb_build_array(
          jsonb_build_object(
            'field', 'task_link',
            'from', null,
            'to', jsonb_build_object('key', v_source.task_key, 'kind', p_kind)
          )
        )
      )
    );

  return v_id;
end;
$$;

create or replace function public.persist_task_moves(
  p_board_id uuid,
  p_updates jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  board_project uuid;
  item jsonb;
  v_task_id uuid;
  v_position integer;
  v_status text;
  v_task_board uuid;
  v_old_status text;
begin
  if p_updates is null or jsonb_typeof(p_updates) <> 'array' then
    raise exception 'p_updates must be a JSON array'
      using errcode = 'P0001';
  end if;

  select b.project_id into board_project
  from public.boards as b
  where b.id = p_board_id;

  if board_project is null then
    raise exception 'Board not found'
      using errcode = 'P0002';
  end if;

  if not public.can_edit_tasks(board_project) then
    raise exception 'Only editors can move tasks'
      using errcode = '42501';
  end if;

  for item in select * from jsonb_array_elements(p_updates)
  loop
    v_task_id := (item ->> 'id')::uuid;
    v_position := (item ->> 'position')::integer;
    v_status := item ->> 'status';

    if v_task_id is null or v_position is null or v_status is null then
      raise exception 'Each update requires id, position, and status'
        using errcode = 'P0001';
    end if;

    select t.board_id, t.status
      into v_task_board, v_old_status
    from public.tasks as t
    where t.id = v_task_id;

    if v_task_board is null then
      raise exception 'Task not found'
        using errcode = 'P0002';
    end if;

    if v_task_board <> p_board_id then
      raise exception 'Task does not belong to board'
        using errcode = 'P0001';
    end if;

    if v_old_status is distinct from v_status
       and exists (
         select 1
         from public.board_columns as bc
         where bc.board_id = p_board_id
           and bc.id = v_status
           and bc.is_done
       )
    then
      perform public.assert_task_may_enter_done(v_task_id);
    end if;

    update public.tasks as t
    set
      position = v_position,
      status = v_status
    where t.id = v_task_id
      and t.board_id = p_board_id;
  end loop;
end;
$$;

create or replace function public.tasks_parent_done_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if exists (
    select 1
    from public.board_columns as bc
    where bc.board_id = new.board_id
      and bc.id = new.status
      and bc.is_done
  ) then
    perform public.assert_task_may_enter_done(new.id);
  end if;

  return new;
end;
$$;
