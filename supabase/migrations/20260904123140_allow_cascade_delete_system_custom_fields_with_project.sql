-- Project DELETE cascades to custom_field_definitions. The Description
-- system field guard blocked that path ("System custom fields cannot be
-- deleted"). Skip the guard when the parent Project no longer exists —
-- same pattern as guard_last_board / tasks_require_archived_before_delete.

create or replace function public.assert_custom_field_definition_deletable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- CASCADE from projects DELETE: parent row is already gone.
  if old.system_key is not null
     and not exists (
       select 1 from public.projects as p where p.id = old.project_id
     ) then
    return old;
  end if;

  if old.system_key is not null then
    raise exception 'System custom fields cannot be deleted'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;
