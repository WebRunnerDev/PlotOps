-- Security Advisor wave (2026-08-31): revoke client EXECUTE on SECURITY DEFINER helpers.
-- See docs/security/advisor-triage-2026-08-31.md categories A–C.
--
-- Batch 1: explicit REVOKE FROM anon on every function still callable without a session.
-- Batch 2: REVOKE FROM authenticated on trigger-only handlers (category A).

-- ---------------------------------------------------------------------------
-- Category B — RLS / ACL helpers (anon only; authenticated required for RLS)
-- ---------------------------------------------------------------------------

revoke all on function public.can_view_project(uuid) from anon;
revoke all on function public.can_edit_tasks(uuid) from anon;
revoke all on function public.can_create_tasks(uuid) from anon;
revoke all on function public.can_delete_tasks(uuid) from anon;
revoke all on function public.can_manage_board(uuid) from anon;
revoke all on function public.can_manage_members(uuid) from anon;
revoke all on function public.can_manage_project_settings(uuid) from anon;
revoke all on function public.can_create_project(uuid) from anon;
revoke all on function public.can_delete_team(uuid) from anon;
revoke all on function public.can_manage_team_members(uuid) from anon;
revoke all on function public.is_project_owner(uuid) from anon;
revoke all on function public.is_project_member(uuid) from anon;
revoke all on function public.project_member_role_of(uuid) from anon;
revoke all on function public.has_project_role(uuid, public.project_member_role[]) from anon;
revoke all on function public.project_team_id(uuid) from anon;
revoke all on function public.is_team_owner(uuid) from anon;
revoke all on function public.is_team_member(uuid) from anon;
revoke all on function public.team_member_role_of(uuid) from anon;
revoke all on function public.has_team_role(uuid, public.project_member_role[]) from anon;

-- ---------------------------------------------------------------------------
-- Category C — intentional authenticated RPC (anon only)
-- ---------------------------------------------------------------------------

revoke all on function public.accept_team_invite(text) from anon;
revoke all on function public.claim_team_invite(text) from anon;
revoke all on function public.confirm_team_invite(uuid, uuid) from anon;
revoke all on function public.transfer_team_ownership(uuid, uuid) from anon;
revoke all on function public.mark_notifications_read(uuid[]) from anon;
revoke all on function public.mark_notifications_read_in_scope(uuid) from anon;
revoke all on function public.cleanup_notifications_for_user() from anon;
revoke all on function public.create_notifications_for_status_change(uuid, uuid, jsonb) from anon;
revoke all on function public.create_notifications_for_watchers(
  uuid,
  uuid,
  text,
  jsonb,
  uuid[]
) from anon;

-- ---------------------------------------------------------------------------
-- Category A — internal / trigger-only (revoke anon + authenticated)
-- ---------------------------------------------------------------------------

revoke all on function public.handle_new_user_profile() from public;
revoke all on function public.handle_new_user_profile() from anon;
revoke all on function public.handle_new_user_profile() from authenticated;

revoke all on function public.handle_new_project_board() from public;
revoke all on function public.handle_new_project_board() from anon;
revoke all on function public.handle_new_project_board() from authenticated;

revoke all on function public.handle_new_project_description_field() from public;
revoke all on function public.handle_new_project_description_field() from anon;
revoke all on function public.handle_new_project_description_field() from authenticated;

revoke all on function public.ensure_project_description_field(uuid) from public;
revoke all on function public.ensure_project_description_field(uuid) from anon;
revoke all on function public.ensure_project_description_field(uuid) from authenticated;
grant execute on function public.ensure_project_description_field(uuid) to service_role;

-- Platform event trigger (may not exist on fresh local stacks).
do $$
begin
  if exists (
    select 1
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    revoke all on function public.rls_auto_enable() from public;
    revoke all on function public.rls_auto_enable() from anon;
    revoke all on function public.rls_auto_enable() from authenticated;
  end if;
end;
$$;

revoke all on function public.task_watchers_on_task_insert() from public;
revoke all on function public.task_watchers_on_task_insert() from anon;
revoke all on function public.task_watchers_on_task_insert() from authenticated;

revoke all on function public.task_watchers_on_task_stake_update() from public;
revoke all on function public.task_watchers_on_task_stake_update() from anon;
revoke all on function public.task_watchers_on_task_stake_update() from authenticated;

revoke all on function public.task_watchers_cleanup_on_team_members_delete() from public;
revoke all on function public.task_watchers_cleanup_on_team_members_delete() from anon;
revoke all on function public.task_watchers_cleanup_on_team_members_delete() from authenticated;
