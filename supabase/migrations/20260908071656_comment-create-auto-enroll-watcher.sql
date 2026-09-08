-- Comment create auto-enrolls the commenter as a Watcher (ADR 0028 / 0029).
-- Comment edit does not enroll. Sticky Unwatch is re-subscribed by this insert.

create or replace function public.task_watchers_on_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.author_id is not null then
    insert into public.task_watchers (task_id, project_id, user_id)
    values (new.task_id, new.project_id, new.author_id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists task_watchers_on_comment_insert on public.task_comments;
create trigger task_watchers_on_comment_insert
  after insert on public.task_comments
  for each row
  execute function public.task_watchers_on_comment_insert();

revoke all on function public.task_watchers_on_comment_insert() from public;
revoke all on function public.task_watchers_on_comment_insert() from anon;
revoke all on function public.task_watchers_on_comment_insert() from authenticated;

notify pgrst, 'reload schema';
