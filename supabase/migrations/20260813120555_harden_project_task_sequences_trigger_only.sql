-- project_task_sequences is an internal counter for trg_set_task_key.
-- pts_task_creators (FOR ALL + can_edit_tasks) let a Contributor set next_val
-- directly, causing task_key collisions or counter jumps. Allocate only from
-- the trigger (SECURITY DEFINER); revoke client writes.

create or replace function public.set_task_key()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  seq bigint;
  prefix text;
begin
  insert into public.project_task_sequences (project_id, next_val)
  values (NEW.project_id, 2)
  on conflict (project_id)
  do update set next_val = public.project_task_sequences.next_val + 1
  returning public.project_task_sequences.next_val - 1 into seq;

  prefix := case NEW.task_type
    when 'bug'     then 'BUG'
    when 'feature' then 'FEAT'
    else                'TASK'
  end;

  NEW.task_key := prefix || '-' || seq;
  return NEW;
end;
$$;

revoke all on function public.set_task_key() from public;
revoke all on function public.set_task_key() from anon;
revoke all on function public.set_task_key() from authenticated;

drop policy if exists "pts_task_creators" on public.project_task_sequences;
drop policy if exists "pts_owner" on public.project_task_sequences;

revoke all on table public.project_task_sequences from public;
revoke all on table public.project_task_sequences from anon;
revoke all on table public.project_task_sequences from authenticated;

notify pgrst, 'reload schema';
