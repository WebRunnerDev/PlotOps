alter table public.tasks
  add column if not exists author_id uuid references public.profiles (id) on delete set null;

create index if not exists tasks_author_id_idx on public.tasks (author_id);
