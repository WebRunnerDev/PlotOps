-- Project-scoped custom text fields (ADR 0024).
-- Definitions: Manager+ CRUD, ≤10 per Project, filtered by Task type via applies_to.
-- Values: Contributor+ upsert; cascade on definition or task delete; kept across type changes.

create table if not exists public.custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  applies_to public.task_type[] not null,
  created_at timestamptz not null default now(),
  constraint custom_field_definitions_name_nonempty
    check (char_length(trim(name)) > 0),
  constraint custom_field_definitions_applies_to_nonempty
    check (cardinality(applies_to) >= 1)
);

create unique index if not exists custom_field_definitions_project_name_unique
  on public.custom_field_definitions (project_id, lower(name));

create index if not exists custom_field_definitions_project_id_idx
  on public.custom_field_definitions (project_id);

create index if not exists custom_field_definitions_project_position_idx
  on public.custom_field_definitions (project_id, position);

create table if not exists public.task_custom_field_values (
  task_id uuid not null references public.tasks (id) on delete cascade,
  field_id uuid not null references public.custom_field_definitions (id) on delete cascade,
  value text not null default '',
  primary key (task_id, field_id)
);

create index if not exists task_custom_field_values_field_id_idx
  on public.task_custom_field_values (field_id);

-- ---------------------------------------------------------------------------
-- Definition guards: no project move, unique applies_to, ≤10 per Project
-- ---------------------------------------------------------------------------

create or replace function public.assert_custom_field_definition_legal()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
  v_distinct integer;
begin
  if tg_op = 'UPDATE'
     and new.project_id is distinct from old.project_id then
    raise exception
      'Custom field definitions cannot move between Projects; copy instead'
      using errcode = 'P0001';
  end if;

  new.name := trim(new.name);
  if new.name = '' then
    raise exception 'Custom field name is required'
      using errcode = '23514';
  end if;

  select cardinality(array_agg(distinct t))
  into v_distinct
  from unnest(new.applies_to) as t;

  if v_distinct is null or v_distinct < 1 then
    raise exception 'Custom field must apply to at least one Task type'
      using errcode = '23514';
  end if;

  if v_distinct <> cardinality(new.applies_to) then
    raise exception 'Custom field applies_to must not contain duplicates'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    select count(*)::integer
    into v_count
    from public.custom_field_definitions as d
    where d.project_id = new.project_id;

    if v_count >= 10 then
      raise exception 'A Project may have at most 10 custom field definitions'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists custom_field_definitions_legal
  on public.custom_field_definitions;
create trigger custom_field_definitions_legal
  before insert or update
  on public.custom_field_definitions
  for each row
  execute function public.assert_custom_field_definition_legal();

revoke all on function public.assert_custom_field_definition_legal() from public;

-- ---------------------------------------------------------------------------
-- Value guards: same Project as definition; block edits on archived Tasks
-- ---------------------------------------------------------------------------

create or replace function public.assert_task_custom_field_value_legal()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task_project uuid;
  v_field_project uuid;
begin
  -- DELETE is allowed so definition hard-delete can cascade values on archived Tasks.
  perform public.assert_task_not_archived(new.task_id);

  select t.project_id
  into v_task_project
  from public.tasks as t
  where t.id = new.task_id;

  if v_task_project is null then
    raise exception 'Task not found'
      using errcode = 'P0002';
  end if;

  select d.project_id
  into v_field_project
  from public.custom_field_definitions as d
  where d.id = new.field_id;

  if v_field_project is null then
    raise exception 'Custom field definition not found'
      using errcode = 'P0002';
  end if;

  if v_task_project <> v_field_project then
    raise exception 'Custom field values must stay inside the same Project'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists task_custom_field_values_legal
  on public.task_custom_field_values;
create trigger task_custom_field_values_legal
  before insert or update
  on public.task_custom_field_values
  for each row
  execute function public.assert_task_custom_field_value_legal();

revoke all on function public.assert_task_custom_field_value_legal() from public;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.custom_field_definitions enable row level security;
alter table public.task_custom_field_values enable row level security;

drop policy if exists "custom_field_definitions_select_member"
  on public.custom_field_definitions;
create policy "custom_field_definitions_select_member"
  on public.custom_field_definitions
  for select
  to authenticated
  using (public.can_view_project(project_id));

drop policy if exists "custom_field_definitions_insert_managers"
  on public.custom_field_definitions;
create policy "custom_field_definitions_insert_managers"
  on public.custom_field_definitions
  for insert
  to authenticated
  with check (public.can_manage_board(project_id));

drop policy if exists "custom_field_definitions_update_managers"
  on public.custom_field_definitions;
create policy "custom_field_definitions_update_managers"
  on public.custom_field_definitions
  for update
  to authenticated
  using (public.can_manage_board(project_id))
  with check (public.can_manage_board(project_id));

drop policy if exists "custom_field_definitions_delete_managers"
  on public.custom_field_definitions;
create policy "custom_field_definitions_delete_managers"
  on public.custom_field_definitions
  for delete
  to authenticated
  using (public.can_manage_board(project_id));

drop policy if exists "task_custom_field_values_select_member"
  on public.task_custom_field_values;
create policy "task_custom_field_values_select_member"
  on public.task_custom_field_values
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tasks as t
      where t.id = task_custom_field_values.task_id
        and public.can_view_project(t.project_id)
    )
  );

drop policy if exists "task_custom_field_values_insert_editors"
  on public.task_custom_field_values;
create policy "task_custom_field_values_insert_editors"
  on public.task_custom_field_values
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.tasks as t
      where t.id = task_custom_field_values.task_id
        and public.can_edit_tasks(t.project_id)
    )
    and exists (
      select 1
      from public.custom_field_definitions as d
      where d.id = task_custom_field_values.field_id
        and public.can_view_project(d.project_id)
    )
  );

drop policy if exists "task_custom_field_values_update_editors"
  on public.task_custom_field_values;
create policy "task_custom_field_values_update_editors"
  on public.task_custom_field_values
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.tasks as t
      where t.id = task_custom_field_values.task_id
        and public.can_edit_tasks(t.project_id)
    )
  )
  with check (
    exists (
      select 1
      from public.tasks as t
      where t.id = task_custom_field_values.task_id
        and public.can_edit_tasks(t.project_id)
    )
    and exists (
      select 1
      from public.custom_field_definitions as d
      where d.id = task_custom_field_values.field_id
        and public.can_view_project(d.project_id)
    )
  );

drop policy if exists "task_custom_field_values_delete_editors"
  on public.task_custom_field_values;
create policy "task_custom_field_values_delete_editors"
  on public.task_custom_field_values
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.tasks as t
      where t.id = task_custom_field_values.task_id
        and public.can_edit_tasks(t.project_id)
    )
  );

grant select, insert, update, delete
  on public.custom_field_definitions to authenticated;
grant select, insert, update, delete
  on public.task_custom_field_values to authenticated;

notify pgrst, 'reload schema';
