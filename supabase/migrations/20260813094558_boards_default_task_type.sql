-- Per-board default for new Tasks (inline create / New Task CTA).
alter table public.boards
  add column if not exists default_task_type public.task_type not null default 'task';
