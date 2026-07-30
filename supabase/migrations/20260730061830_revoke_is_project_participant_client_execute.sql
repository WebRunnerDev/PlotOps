-- is_project_participant is an internal SECURITY DEFINER helper used only by
-- other definer notification fan-out functions. Granting EXECUTE to
-- authenticated exposed a cross-project membership-enumeration oracle
-- (arbitrary project_id + user_id → boolean).
--
-- Nested calls from SECURITY DEFINER owners still work after revoke: the
-- outer function runs as its owner, which retains EXECUTE.

revoke all on function public.is_project_participant(uuid, uuid) from public;
revoke all on function public.is_project_participant(uuid, uuid) from anon;
revoke all on function public.is_project_participant(uuid, uuid) from authenticated;

grant execute on function public.is_project_participant(uuid, uuid) to service_role;
