-- Sticky Watch (ADR 0028): keep Auto-enroll on Author/Assignee set;
-- remove Auto-Unwatch deletes when stake is lost.

create or replace function public.task_watchers_on_task_stake_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Auto-enroll new Author
  if new.author_id is not null
     and (old.author_id is distinct from new.author_id) then
    insert into public.task_watchers (task_id, project_id, user_id)
    values (new.id, new.project_id, new.author_id)
    on conflict do nothing;
  end if;

  -- Auto-enroll new Assignee
  if new.assignee_id is not null
     and (old.assignee_id is distinct from new.assignee_id) then
    insert into public.task_watchers (task_id, project_id, user_id)
    values (new.id, new.project_id, new.assignee_id)
    on conflict do nothing;
  end if;

  -- Sticky Watch: losing Author/Assignee does not delete Watch.
  -- Manual Unwatch sticks until Author/Assignee is set onto the user again.

  return new;
end;
$$;

revoke all on function public.task_watchers_on_task_stake_update() from public;
revoke all on function public.task_watchers_on_task_stake_update() from anon;
revoke all on function public.task_watchers_on_task_stake_update() from authenticated;

notify pgrst, 'reload schema';
