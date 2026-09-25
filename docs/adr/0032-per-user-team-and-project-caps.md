# Per-user Team caps and a per-Team Project cap

PlotOps runs on a Free-tier Supabase project. Nothing stopped one account from creating Teams, redeeming open invites, or connecting repositories without bound — each of which fans out Boards, Tasks, Sprints, and Notification rows. The product also has no billing, so there is no tier to price these against; the ceiling has to be a flat product rule.

## Decision

Three caps, enforced in Postgres and mirrored in the app:

| Cap                      | Value  | Counted over                                 |
| ------------------------ | ------ | -------------------------------------------- |
| `teams_owned_cap()`      | **3**  | rows in `teams` with `owner_id = user`       |
| `team_memberships_cap()` | **10** | rows in `team_members` with `user_id = user` |
| `team_projects_cap()`    | **10** | rows in `projects` with `team_id = team`     |

- **Owning and joining are separate counters.** The Owner is `teams.owner_id` and never a `team_members` row, so the two sets do not overlap: a user may own 3 Teams _and_ belong to 10 more.
- **Projects are capped per Team, not per user.** Projects have no membership of their own — access is inherited from the Team (ADR 0017) — so there is no "join a Project" action to cap, and a per-user Project count would block Team invites for reasons the invitee cannot see or fix.
- **Enforcement is a `BEFORE INSERT` trigger per table**, not an RLS clause. The invite RPCs (`accept_team_invite`, `confirm_team_invite`) are `security definer` and bypass RLS entirely; a trigger covers those paths and direct inserts alike.
- **The trigger functions are `security definer`.** The counts span rows the caller cannot read — an Admin adding a Member cannot see that Member's other Teams — so an invoker-rights count would silently undercount and let the cap through.
- **Ownership transfer re-checks the owned cap.** `transfer_team_ownership` updates `teams.owner_id`; without an `UPDATE OF owner_id` trigger the owned cap is one transfer away from meaningless.
- **The Owner demoted by a transfer is exempt from the membership cap.** `transfer_team_ownership` inserts their `team_members` row while `teams.owner_id` still points at them, so the trigger recognises that case and allows it. The user's total Team count is unchanged by the transfer; failing it would strand an Owner who is at both caps and cannot leave their own Team.
- **Errors are raised as `P0001` with a `hint`** naming the cap, and the client matches the hint rather than parsing the error text. `53400` (`configuration_limit_exceeded`) is the better fit semantically, but PostgREST maps class 53 to HTTP 503, which reads to the client as an outage and invites a retry.
- **The app mirrors the numbers** in `src/features/teams/model/limits.ts` and `src/features/projects/model/limits.ts` so the affordance is disabled with an explanation instead of failing on submit. The DB stays authoritative; the client check is a courtesy, and the trigger remains the backstop for races.
- **Guest Mode is not capped.** The sandbox is local, per-session, and costs nothing.

## Rejected

- **RLS `WITH CHECK` clauses instead of triggers** — invisible to the `security definer` invite RPCs, which are the main way a user joins a Team.
- **A per-user cap on total accessible Projects** — a Team invite would then fail based on how many Projects that Team happens to hold, which the invitee can neither see beforehand nor act on. It also makes any Project added to a large Team able to silently evict nobody while blocking everyone's future invites.
- **Client-only limits** — trivially bypassed via the REST API, and the storage they exist to protect is on the server.
- **A `plans` / `tiers` table** — there is no billing to key it to; a flat constant in one SQL function is a smaller thing to change when billing does arrive.
- **Capping Boards, Tasks, or Sprints too** — those grow inside an already-capped Project, and per-entity caps would interrupt normal work rather than bound signup-driven fan-out.
