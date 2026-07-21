-- Task comments + rich-text size limits (128 KiB description, 32 KiB per comment).

alter table public.tasks
  drop constraint if exists tasks_description_length;

alter table public.tasks
  add constraint tasks_description_length
  check (description is null or char_length(description) <= 131072);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_comments_body_length check (char_length(body) between 1 and 32768)
);

create index if not exists task_comments_task_id_idx
  on public.task_comments (task_id, created_at);

create index if not exists task_comments_project_id_idx
  on public.task_comments (project_id);

create or replace function public.set_task_comment_project_id()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.project_id is null then
    select t.project_id
    into new.project_id
    from public.tasks as t
    where t.id = new.task_id;
  end if;

  return new;
end;
$$;

drop trigger if exists task_comments_set_project_id on public.task_comments;

create trigger task_comments_set_project_id
  before insert on public.task_comments
  for each row
  execute function public.set_task_comment_project_id();

create or replace function public.set_task_comments_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists task_comments_set_updated_at on public.task_comments;

create trigger task_comments_set_updated_at
  before update on public.task_comments
  for each row
  execute function public.set_task_comments_updated_at();

alter table public.task_comments enable row level security;

create policy "task_comments_select_member"
  on public.task_comments
  for select
  to authenticated
  using (public.can_view_project(project_id));

create policy "task_comments_insert_editors"
  on public.task_comments
  for insert
  to authenticated
  with check (
    public.can_edit_tasks(project_id)
    and author_id = (select auth.uid())
  );

create policy "task_comments_update_own"
  on public.task_comments
  for update
  to authenticated
  using (
    author_id = (select auth.uid())
    and public.can_edit_tasks(project_id)
  )
  with check (
    author_id = (select auth.uid())
    and public.can_edit_tasks(project_id)
  );

create policy "task_comments_delete_own_or_manager"
  on public.task_comments
  for delete
  to authenticated
  using (
    (
      author_id = (select auth.uid())
      and public.can_edit_tasks(project_id)
    )
    or public.can_delete_tasks(project_id)
  );

notify pgrst, 'reload schema';
