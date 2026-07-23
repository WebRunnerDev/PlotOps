-- Cap task titles at 255 characters (Jira / GitHub issue title length).

alter table public.tasks
  drop constraint if exists tasks_title_length;

alter table public.tasks
  add constraint tasks_title_length
  check (char_length(title) between 1 and 255);
