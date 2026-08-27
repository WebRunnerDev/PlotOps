-- One-level comment replies (YouTube / Jira style).
-- parent_id points at the thread root only; UI never nests further.
-- ON DELETE CASCADE: deleting a root removes its replies (no orphan roots).

alter table public.task_comments
  add column if not exists parent_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'task_comments_parent_id_fkey'
      and conrelid = 'public.task_comments'::regclass
  ) then
    alter table public.task_comments
      add constraint task_comments_parent_id_fkey
      foreign key (parent_id) references public.task_comments (id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'task_comments_parent_not_self'
      and conrelid = 'public.task_comments'::regclass
  ) then
    alter table public.task_comments
      add constraint task_comments_parent_not_self
      check (parent_id is distinct from id);
  end if;
end $$;

create index if not exists task_comments_task_parent_created_idx
  on public.task_comments (task_id, parent_id, created_at);

create or replace function public.assert_task_comment_parent_legal()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_parent public.task_comments%rowtype;
begin
  if tg_op = 'UPDATE'
    and old.parent_id is not distinct from new.parent_id
    and old.task_id is not distinct from new.task_id then
    return new;
  end if;

  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'A Comment cannot reply to itself'
      using errcode = 'P0001';
  end if;

  select *
    into v_parent
  from public.task_comments as c
  where c.id = new.parent_id;

  if not found then
    raise exception 'Parent Comment not found'
      using errcode = 'P0002';
  end if;

  if v_parent.task_id <> new.task_id then
    raise exception 'Parent Comment must belong to the same Task'
      using errcode = 'P0001';
  end if;

  -- One display level: parent must be a root (not another reply).
  if v_parent.parent_id is not null then
    raise exception 'Reply parent must be a root Comment'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists task_comments_assert_parent on public.task_comments;

create trigger task_comments_assert_parent
  before insert or update of parent_id, task_id
  on public.task_comments
  for each row
  execute function public.assert_task_comment_parent_legal();

notify pgrst, 'reload schema';
