-- task_comments shipped RLS policies but never GRANT'd DML to authenticated
-- (same class of bug as sprints — see 20260804131333_grant_sprints_authenticated).
-- PostgREST then returns 42501 "permission denied for table task_comments".

grant select, insert, update, delete on public.task_comments to authenticated;
