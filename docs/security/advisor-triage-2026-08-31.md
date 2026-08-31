# Security Advisor triage (2026-08-31)

Source export: [`advisor-export-2026-08-31.json`](advisor-export-2026-08-31.json) — **79 WARN**, project `ijcelrdcygzyzhcijkhe`.

**Do not triage 79 rows individually.** Fix by **category** (see [GitHub issue #229](https://github.com/WebRunnerDev/PlotOps/issues/229)).

## Summary

| Category | Lint / item                                | Count | Action                                                                                                          |
| -------- | ------------------------------------------ | ----- | --------------------------------------------------------------------------------------------------------------- |
| **A**    | Internal / trigger-only `SECURITY DEFINER` | 8     | `REVOKE EXECUTE` from `anon`, `authenticated`, `PUBLIC`; keep `service_role` where triggers call nested helpers |
| **B**    | RLS / ACL helper functions                 | 19    | `REVOKE` from `anon`; keep `authenticated` (Advisor will still warn — **accepted** if no cross-tenant oracle)   |
| **C**    | Intentional client RPC                     | 14    | `REVOKE` from `anon`; keep `authenticated`; verify `auth.uid()` / role checks inside                            |
| **D**    | Storage `task-media` listing               | 1     | Replace broad `SELECT` policy with path-scoped or signed-URL pattern                                            |
| **E**    | Auth leaked-password protection            | 1     | Dashboard → Auth → enable HaveIBeenPwned (no migration)                                                         |

After batch **A + anon revokes on B/C**, re-run Security Advisor. Expect **~25–35** remaining WARN on **B** (RLS helpers) and **C** (RPC) — document as accepted or revisit in Wave 2.

### Legend

| Class   | Meaning                                                      |
| ------- | ------------------------------------------------------------ |
| **A**   | Never called from SPA; triggers / bootstrap only             |
| **B**   | Used in RLS policies; `authenticated` EXECUTE often required |
| **C**   | Called via `supabase.rpc()` from app or Edge (service role)  |
| **D/E** | Non-function findings                                        |

---

## A — Internal / trigger-only (revoke all client EXECUTE)

| Function                                       | Args                | anon | auth | Notes                                                                                           |
| ---------------------------------------------- | ------------------- | ---- | ---- | ----------------------------------------------------------------------------------------------- |
| `handle_new_user_profile`                      | —                   | ✓    | ✓    | Auth signup trigger                                                                             |
| `handle_new_project_board`                     | —                   | ✓    | ✓    | Project insert trigger                                                                          |
| `handle_new_project_description_field`         | —                   | ✓    | ✓    | Project insert trigger                                                                          |
| `ensure_project_description_field`             | `p_project_id uuid` | ✓    | ✓    | Trigger + backfill; migration already grants **service_role only** — re-apply revoke on replace |
| `rls_auto_enable`                              | —                   | ✓    | ✓    | Event trigger for new tables                                                                    |
| `task_watchers_on_task_insert`                 | —                   | ✓    | ✓    | Task insert trigger                                                                             |
| `task_watchers_on_task_stake_update`           | —                   | ✓    | ✓    | Task update trigger                                                                             |
| `task_watchers_cleanup_on_team_members_delete` | —                   | ✓    | ✓    | Team member delete trigger                                                                      |

**Migration pattern** (same as [`20260730061830_revoke_is_project_participant_client_execute.sql`](../../supabase/migrations/20260730061830_revoke_is_project_participant_client_execute.sql)):

```sql
revoke all on function public.handle_new_user_profile() from public;
revoke all on function public.handle_new_user_profile() from anon;
revoke all on function public.handle_new_user_profile() from authenticated;
-- grant execute … to service_role;  -- only if nested SD callers need it
```

---

## B — RLS / ACL helpers (revoke `anon`; keep `authenticated`)

Used in policies and sometimes from app for UI gating. **Revoking `authenticated` breaks RLS** unless policies are rewritten.

| Function                      | Args                        | anon | auth | Risk if `anon` kept          |
| ----------------------------- | --------------------------- | ---- | ---- | ---------------------------- |
| `can_view_project`            | `project_uuid uuid`         | ✓    | ✓    | Membership / existence probe |
| `can_edit_tasks`              | `project_uuid uuid`         | ✓    | ✓    | Same                         |
| `can_create_tasks`            | `project_uuid uuid`         | ✓    | ✓    | Same                         |
| `can_delete_tasks`            | `project_uuid uuid`         | ✓    | ✓    | Same                         |
| `can_manage_board`            | `project_uuid uuid`         | ✓    | ✓    | Same                         |
| `can_manage_members`          | `project_uuid uuid`         | ✓    | ✓    | Same                         |
| `can_manage_project_settings` | `project_uuid uuid`         | ✓    | ✓    | Same                         |
| `can_create_project`          | `team_uuid uuid`            | ✓    | ✓    | Team role probe              |
| `can_delete_team`             | `team_uuid uuid`            | ✓    | ✓    | Same                         |
| `can_manage_team_members`     | `team_uuid uuid`            | ✓    | ✓    | Same                         |
| `is_project_owner`            | `project_uuid uuid`         | ✓    | ✓    | Same                         |
| `is_project_member`           | `project_uuid uuid`         | ✓    | ✓    | Same                         |
| `project_member_role_of`      | `project_uuid uuid`         | ✓    | ✓    | Role enumeration             |
| `has_project_role`            | `project_uuid`, `allowed[]` | ✓    | ✓    | Same                         |
| `project_team_id`             | `project_uuid uuid`         | ✓    | ✓    | ID leak                      |
| `is_team_owner`               | `team_uuid uuid`            | ✓    | ✓    | Same                         |
| `is_team_member`              | `team_uuid uuid`            | ✓    | ✓    | Same                         |
| `team_member_role_of`         | `team_uuid uuid`            | ✓    | ✓    | Same                         |
| `has_team_role`               | `team_uuid`, `allowed[]`    | ✓    | ✓    | Same                         |

**Post-fix:** Advisor **authenticated** WARN remains — add ADR note or `hardening-plan.md` “accepted warnings” list.

Prior art: [`20260803130716_team_above_project_schema.sql`](../../supabase/migrations/20260803130716_team_above_project_schema.sql) revokes from `PUBLIC` but **does not revoke from `anon` explicitly** — likely why Advisor still reports 36 `anon` rows.

---

## C — Intentional client RPC (revoke `anon`; keep `authenticated`)

| Function                                     | Args                          | anon | auth | Called from                                                |
| -------------------------------------------- | ----------------------------- | ---- | ---- | ---------------------------------------------------------- |
| `accept_team_invite`                         | `p_token text`                | ✓    | ✓    | `members-api.ts` (requires session in UI)                  |
| `claim_team_invite`                          | `p_token text`                | ✓    | ✓    | `members-api.ts`                                           |
| `confirm_team_invite`                        | `p_invite_id`, `p_user_id`    | ✓    | ✓    | `members-api.ts`, `team-members-api.ts`                    |
| `get_team_invite_by_token`                   | `p_token text`                | —    | ✓    | `members-api.ts`; already hardened — **no anon** in export |
| `transfer_team_ownership`                    | `p_team_id`, `p_new_owner_id` | ✓    | ✓    | `team-members-api.ts`                                      |
| `mark_notifications_read`                    | `p_notification_ids uuid[]`   | ✓    | ✓    | `notifications-api.ts`                                     |
| `mark_notifications_read_in_scope`           | `p_project_id uuid`           | ✓    | ✓    | `notifications-api.ts`                                     |
| `cleanup_notifications_for_user`             | —                             | ✓    | ✓    | `notifications-api.ts`                                     |
| `create_notifications_for_status_change`     | task, project, metadata       | ✓    | ✓    | `notifications-api.ts`, `github-webhook` (service role)    |
| `create_notifications_for_watchers`          | …                             | ✓    | ✓    | `notifications-api.ts`                                     |
| `create_notifications_for_assignment_change` | …                             | —    | ✓    | `notifications-api.ts`                                     |
| `create_notifications_for_author_change`     | …                             | —    | ✓    | Trigger / internal fan-out                                 |
| `create_notifications_for_mentions`          | …                             | —    | ✓    | `notifications-api.ts`                                     |
| `create_task_notifications`                  | …                             | —    | ✓    | `notifications-api.ts`                                     |

**Invite flow:** Product copy requires sign-in before accept (`board` i18n). **Do not grant `anon`** on invite RPCs; preview uses authenticated `get_team_invite_by_token` after login.

**Notification RPCs:** Consider moving fan-out fully into triggers + revoking client EXECUTE on `create_notifications_*` in a later hardening pass (larger refactor). For this wave: **revoke `anon` only**.

---

## D — Storage: `task-media` public listing

| Item                | Lint                           | Detail                                                                        |
| ------------------- | ------------------------------ | ----------------------------------------------------------------------------- |
| Bucket `task-media` | `public_bucket_allows_listing` | Policy `task_media_select_public` allows listing all objects in public bucket |

**Fix options** (pick one in migration):

1. **Path-scoped SELECT** — e.g. allow read only when `(storage.foldername(name))[1]` matches a project/task the caller can view (harder for public bucket).
2. **Private bucket + signed URLs** — preferred long-term; requires SPA upload/read path change.
3. **Minimal** — drop listing: replace blanket `using (bucket_id = 'task-media')` with policy that does not expose `list` (objects still reachable by known URL if bucket stays `public`).

Migration: [`20260716125100_task_media_storage.sql`](../../supabase/migrations/20260716125100_task_media_storage.sql).

---

## E — Auth: leaked password protection

| Item   | Lint                              | Fix                                                                                             |
| ------ | --------------------------------- | ----------------------------------------------------------------------------------------------- |
| GoTrue | `auth_leaked_password_protection` | Supabase Dashboard → **Authentication → Password security** → enable leaked password protection |

Complements Wave 1 password length/complexity in `supabase/config.toml`.

---

## Suggested migration batches

| PR / migration                           | Scope                                                                                          |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `revoke_anon_security_definer_execute`   | Explicit `REVOKE … FROM anon` on all **A + B + C** functions (single file, ~40 `REVOKE` lines) |
| `revoke_trigger_function_client_execute` | **A** only: also revoke `authenticated` on trigger handlers                                    |
| `harden_task_media_storage_select`       | **D**: narrow or remove list policy                                                            |
| Ops (no SQL)                             | **E**: Dashboard toggle                                                                        |

**Verify locally:** `npm run db:reset` → pgTAP / invite tests under `supabase/tests/` → re-export Advisor after deploy to `main`.

---

## Related

- [`hardening-plan.md`](hardening-plan.md) — Wave 1 / advisor section
- [`docs/SUPABASE.md`](../SUPABASE.md) — migration workflow (CI only to remote)
