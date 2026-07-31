-- Atomic label move across projects: strip task links then reassign project.

create or replace function public.move_project_label(
  p_label_id uuid,
  p_target_project_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_project uuid;
  label_name text;
begin
  select l.project_id, l.name into source_project, label_name
  from public.labels as l
  where l.id = p_label_id;

  if source_project is null then
    raise exception 'Label not found'
      using errcode = 'P0002';
  end if;

  if source_project = p_target_project_id then
    return;
  end if;

  if not public.is_project_owner(source_project) then
    raise exception 'Only project owners can move labels'
      using errcode = '42501';
  end if;

  if not public.is_project_owner(p_target_project_id) then
    raise exception 'Only project owners can move labels into a project'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.projects as p
    where p.id = p_target_project_id
  ) is not true then
    raise exception 'Target project not found'
      using errcode = 'P0002';
  end if;

  delete from public.task_labels
  where label_id = p_label_id;

  update public.labels as l
  set project_id = p_target_project_id
  where l.id = p_label_id;
end;
$$;

revoke all on function public.move_project_label(uuid, uuid) from public;
grant execute on function public.move_project_label(uuid, uuid) to authenticated;
