-- Default new tasks to medium priority; backfill existing nulls.
alter table public.tasks
  alter column priority set default 'medium';

update public.tasks
set priority = 'medium'
where priority is null;
