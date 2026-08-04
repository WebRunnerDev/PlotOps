-- sprints / sprint_events shipped RLS policies but never GRANT'd DML to
-- authenticated (unlike tasks/boards). PostgREST then returns 42501
-- "permission denied for table sprints" for every signed-in user.

grant select, insert, update, delete on public.sprints to authenticated;
grant select, insert, update, delete on public.sprint_events to authenticated;
