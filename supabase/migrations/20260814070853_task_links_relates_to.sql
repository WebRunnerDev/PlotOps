-- Task Links (`relates to`): Project-scoped peer edges, RLS, RPCs, Activity.
-- Domain legality matches ADR 0023 / task-structure.ts. No Notification fan-out.

create table if not exists public.task_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  source_task_id uuid not null references public.tasks (id) on delete cascade,
  target_task_id uuid not null references public.tasks (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  constraint task_links_not_self check (source_task_id <> target_task_id),
  constraint task_links_kind_check check (kind = 'relates_to')
);

create unique index if not exists task_links_undirected_kind_idx
  on public.task_links (
    kind,
    least(source_task_id, target_task_id),
    greatest(source_task_id, target_task_id)
  );

create index if not exists task_links_source_task_id_idx
  on public.task_links (source_task_id);

create index if not exists task_links_target_task_id_idx
  on public.task_links (target_task_id);

create index if not exists task_links_project_id_idx
  on public.task_links (project_id);

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

  if new.kind is distinct from 'relates_to' then
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

  if exists (
    select 1
    from public.task_links as existing
    where existing.kind = new.kind
      and existing.id is distinct from new.id
      and least(existing.source_task_id, existing.target_task_id)
        = least(new.source_task_id, new.target_task_id)
      and greatest(existing.source_task_id, existing.target_task_id)
        = greatest(new.source_task_id, new.target_task_id)
  ) then
    raise exception 'These Tasks are already linked'
      using errcode = 'P0001';
  end if;

  new.project_id := v_source.project_id;
  return new;
end;
$$;

drop trigger if exists task_links_legal on public.task_links;
create trigger task_links_legal
  before insert or update
  on public.task_links
  for each row
  execute function public.assert_task_link_legal();

revoke all on function public.assert_task_link_legal() from public;

alter table public.task_links enable row level security;

drop policy if exists "task_links_select_member" on public.task_links;
create policy "task_links_select_member"
  on public.task_links
  for select
  to authenticated
  using (public.can_view_project(project_id));

drop policy if exists "task_links_insert_editors" on public.task_links;
create policy "task_links_insert_editors"
  on public.task_links
  for insert
  to authenticated
  with check (
    public.can_edit_tasks(project_id)
    and created_by = (select auth.uid())
  );

drop policy if exists "task_links_delete_editors" on public.task_links;
create policy "task_links_delete_editors"
  on public.task_links
  for delete
  to authenticated
  using (public.can_edit_tasks(project_id));

grant select, insert, delete on public.task_links to authenticated;

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
  if p_kind is distinct from 'relates_to' then
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

  if exists (
    select 1
    from public.task_links as existing
    where existing.kind = p_kind
      and least(existing.source_task_id, existing.target_task_id)
        = least(p_source_task_id, p_target_task_id)
      and greatest(existing.source_task_id, existing.target_task_id)
        = greatest(p_source_task_id, p_target_task_id)
  ) then
    raise exception 'These Tasks are already linked'
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

create or replace function public.delete_task_link(p_link_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_link public.task_links%rowtype;
  v_source public.tasks%rowtype;
  v_target public.tasks%rowtype;
begin
  select * into v_link
  from public.task_links as link
  where link.id = p_link_id;

  if not found then
    raise exception 'Task Link not found'
      using errcode = 'P0002';
  end if;

  if not public.can_edit_tasks(v_link.project_id) then
    raise exception 'Only editors can remove a Task Link'
      using errcode = '42501';
  end if;

  select * into v_source
  from public.tasks as t
  where t.id = v_link.source_task_id;

  select * into v_target
  from public.tasks as t
  where t.id = v_link.target_task_id;

  delete from public.task_links as link
  where link.id = p_link_id;

  if v_source.id is not null then
    insert into public.activity_log (
      task_id,
      project_id,
      user_id,
      action,
      metadata
    )
    values (
      v_source.id,
      v_link.project_id,
      (select auth.uid()),
      'updated',
      jsonb_build_object(
        'changes',
        jsonb_build_array(
          jsonb_build_object(
            'field', 'task_link',
            'from', case
              when v_target.id is null then null
              else jsonb_build_object('key', v_target.task_key, 'kind', v_link.kind)
            end,
            'to', null
          )
        )
      )
    );
  end if;

  if v_target.id is not null then
    insert into public.activity_log (
      task_id,
      project_id,
      user_id,
      action,
      metadata
    )
    values (
      v_target.id,
      v_link.project_id,
      (select auth.uid()),
      'updated',
      jsonb_build_object(
        'changes',
        jsonb_build_array(
          jsonb_build_object(
            'field', 'task_link',
            'from', case
              when v_source.id is null then null
              else jsonb_build_object('key', v_source.task_key, 'kind', v_link.kind)
            end,
            'to', null
          )
        )
      )
    );
  end if;
end;
$$;

revoke all on function public.create_task_link(uuid, uuid, text) from public;
grant execute on function public.create_task_link(uuid, uuid, text) to authenticated;
revoke all on function public.delete_task_link(uuid) from public;
grant execute on function public.delete_task_link(uuid) to authenticated;

notify pgrst, 'reload schema';
