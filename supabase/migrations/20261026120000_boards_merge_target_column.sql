-- Development Board: where `github-webhook` moves a Task after its PR merges
-- into the Base branch. `last_column` keeps the previous behaviour (highest
-- position); `column` uses merge_target_column_id; `none` only sets
-- pr_state = merged.

alter table public.boards
  add column if not exists merge_target_mode text not null default 'last_column',
  add column if not exists merge_target_column_id text;

comment on column public.boards.merge_target_mode is
  'After a PR merge into Base branch: last_column | column | none.';
comment on column public.boards.merge_target_column_id is
  'Target board_columns.id when merge_target_mode = column.';

alter table public.boards
  drop constraint if exists boards_merge_target_mode_check;

alter table public.boards
  add constraint boards_merge_target_mode_check
  check (merge_target_mode in ('last_column', 'column', 'none'));

alter table public.boards
  drop constraint if exists boards_merge_target_column_matches_mode;

alter table public.boards
  add constraint boards_merge_target_column_matches_mode
  check ((merge_target_mode = 'column') = (merge_target_column_id is not null));

-- Composite FK keeps the target on the same Board. Deleting the column nulls
-- only merge_target_column_id; the trigger below then flips the mode to none.
alter table public.boards
  drop constraint if exists boards_merge_target_column_fkey;

alter table public.boards
  add constraint boards_merge_target_column_fkey
  foreign key (id, merge_target_column_id)
  references public.board_columns (board_id, id)
  on delete set null (merge_target_column_id);

create or replace function public.boards_merge_target_column_deleted()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.merge_target_mode = 'column'
    and new.merge_target_column_id is null
    and old.merge_target_column_id is not null then
    new.merge_target_mode := 'none';
  end if;

  return new;
end;
$$;

drop trigger if exists boards_merge_target_column_deleted on public.boards;

create trigger boards_merge_target_column_deleted
  before update of merge_target_column_id on public.boards
  for each row
  execute function public.boards_merge_target_column_deleted();

notify pgrst, 'reload schema';
