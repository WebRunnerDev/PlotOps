-- Built-in Description as a non-deletable system custom-field definition (ADR 0024).
-- Values stay on tasks.description; the definition only controls label, applies_to, and order.
-- Cap ≤10 counts only non-system definitions. Every Project always has Description.

alter table public.custom_field_definitions
  add column if not exists system_key text;

alter table public.custom_field_definitions
  drop constraint if exists custom_field_definitions_system_key_known;

alter table public.custom_field_definitions
  add constraint custom_field_definitions_system_key_known
  check (
    system_key is null
    or system_key = 'description'
  );

create unique index if not exists custom_field_definitions_project_system_key_unique
  on public.custom_field_definitions (project_id, system_key)
  where system_key is not null;

-- ---------------------------------------------------------------------------
-- Definition guards: system_key immutable; cap excludes system rows
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

  -- Clients may only create/promote system rows while the seed flag is on.
  if tg_op = 'INSERT'
     and new.system_key is not null
     and coalesce(current_setting('plotops.allow_system_custom_field', true), '')
         is distinct from 'on' then
    raise exception 'System custom fields cannot be created directly'
      using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE'
     and new.system_key is distinct from old.system_key then
    if not (
      old.system_key is null
      and new.system_key is not null
      and coalesce(current_setting('plotops.allow_system_custom_field', true), '')
          = 'on'
    ) then
      raise exception 'Custom field system_key cannot change'
        using errcode = 'P0001';
    end if;
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

  if tg_op = 'INSERT' and new.system_key is null then
    select count(*)::integer
    into v_count
    from public.custom_field_definitions as d
    where d.project_id = new.project_id
      and d.system_key is null;

    if v_count >= 10 then
      raise exception 'A Project may have at most 10 custom field definitions'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.assert_custom_field_definition_deletable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.system_key is not null then
    raise exception 'System custom fields cannot be deleted'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists custom_field_definitions_deletable
  on public.custom_field_definitions;
create trigger custom_field_definitions_deletable
  before delete
  on public.custom_field_definitions
  for each row
  execute function public.assert_custom_field_definition_deletable();

revoke all on function public.assert_custom_field_definition_deletable() from public;

-- Block EAV values for Description — body lives on tasks.description.
create or replace function public.assert_task_custom_field_value_legal()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task_project uuid;
  v_field_project uuid;
  v_system_key text;
begin
  perform public.assert_task_not_archived(new.task_id);

  select t.project_id
  into v_task_project
  from public.tasks as t
  where t.id = new.task_id;

  if v_task_project is null then
    raise exception 'Task not found'
      using errcode = 'P0002';
  end if;

  select d.project_id, d.system_key
  into v_field_project, v_system_key
  from public.custom_field_definitions as d
  where d.id = new.field_id;

  if v_field_project is null then
    raise exception 'Custom field definition not found'
      using errcode = 'P0002';
  end if;

  if v_system_key is not null then
    raise exception 'System custom fields do not store values in task_custom_field_values'
      using errcode = 'P0001';
  end if;

  if v_task_project <> v_field_project then
    raise exception 'Custom field values must stay inside the same Project'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Seed Description on every Project (new + backfill)
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
    array['task', 'bug', 'feature']::public.task_type[],
    'description'
  );
end;
$$;

revoke all on function public.ensure_project_description_field(uuid) from public;
grant execute on function public.ensure_project_description_field(uuid) to service_role;

create or replace function public.handle_new_project_description_field()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.ensure_project_description_field(new.id);
  return new;
end;
$$;

drop trigger if exists projects_create_description_field on public.projects;
create trigger projects_create_description_field
  after insert on public.projects
  for each row
  execute function public.handle_new_project_description_field();

revoke all on function public.handle_new_project_description_field() from public;

-- Backfill existing Projects.
do $$
declare
  r record;
begin
  for r in select id from public.projects
  loop
    perform public.ensure_project_description_field(r.id);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
