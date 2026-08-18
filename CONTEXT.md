# PlotOps

Git-native project tracker (Linear/Jira-style) with GitHub integration. Collaboration and access are scoped to a Team; Projects live under a Team and hold work (Boards, Tasks, linked GitHub repo).

## Language

### Identity

**Display name**:
How a person is shown in the product UI: First name and Last name joined. Falls back to Username when names are missing.
_Avoid_: full name (ambiguous with GitHub `name`), label (UI-only)

**Username**:
The user's short handle on PlotOps — typically the GitHub login. A compact identifier, not the person's real name.
_Avoid_: display name, nickname (when meaning the real-name fields), login (Auth credential sense)

**First name**:
The user's given name, collected at registration (email or after GitHub sign-in). Part of how the person is shown to others; distinct from Username.
_Avoid_: display name (prefer First name + Last name), given name (synonym; First name is canonical here)

**Last name**:
The user's family name, collected at registration alongside First name. Distinct from Username.
_Avoid_: surname, family name (synonyms; Last name is canonical here)

**Guest Mode**:
An application mode in which the visitor explores a local demo sandbox (pre-seeded Teams, Projects, Boards, Tasks, and related demo surfaces) without a Supabase-backed account. Not a Team Role.
_Avoid_: Demo Mode, demo auth mode, guest role, anonymous user (Auth sense)

**Guest Session**:
The active client-side stay in Guest Mode: the mode flag plus the sandboxed demo data for that browser session. Cleared when the visitor leaves Guest Mode, resets the demo, or ends the browser session.
_Avoid_: Auth session, demo login, anonymous session

### Ownership & access

**Team**:
The unit of ownership and collaboration. Members, Roles, and Invites belong to a Team. A Team owns zero or more Projects. Access to every Project in the Team is inherited from Team membership — there is no separate Project membership.
_Avoid_: Workspace, Organization, Project (when meaning the access boundary)

**Project**:
A unit of work inside exactly one Team: Boards, Tasks, Labels, and a linked GitHub repository. Does not own Members or Roles — those live on the Team. Created by connecting a GitHub repository (Projects without a repo are out of scope for now).
_Avoid_: Team, Workspace, repository (the GitHub repo is linked to the Project, not the same concept)

**Board**:
A kanban workflow inside a Project: its own columns and Tasks. A Project may have several Boards (e.g. Core, Frontend). Git branch mapping for that workflow belongs to the Board. Every Project has at least one Board. A Board may be deleted only when it has no Tasks and is not the Project's last Board.
_Avoid_: Kanban, workspace board, Team board (Boards are Project-scoped, not Team-scoped)

**Base branch**:
The single Git branch a Board treats as the default PR target (merge destination). Owned by the Board; seeded from the Project's repo default branch when the Board is created, then editable per Board. A Task is considered merge-complete (e.g. auto-DONE) when its PR merges into that Task's Board Base branch — not into an arbitrary project default.
_Avoid_: default branch (that term is the repo/GitHub default on the Project), main (a common value, not the concept)

**Allowed head pattern**:
A glob-like rule on a Board that describes which task head-branch names fit that Board's workflow (e.g. `feature/*`, `fix/CORE-*`). An empty list means any branch is allowed. When patterns exist and a linked/generated name does not match, the product warns and may ask for confirmation — it does not hard-block.
_Avoid_: branch filter, branch whitelist (implies hard deny)

**Auto-assign to creator**:
A Board setting that assigns new Tasks (and Subtasks) on that Board to the person who created them. Shown in Board settings and applied only when the Team has a single person (Owner and no Members). Distinct from later Assignee edits in the Task drawer.
_Avoid_: auto-assign to me (UI copy only; persistence is creator-relative)

**Task**:
A unit of work that always belongs to exactly one Board (and thus to that Board's Project). May optionally be a Subtask of one Parent Task in the same Project. May optionally have Task Links to other Tasks in the same Project. May optionally link a Git branch and/or pull request. May optionally belong to one Sprint on that Board. May optionally carry an Estimate (Fibonacci story points). May be moved to another Board in the same Project; on move, status is remapped to a matching column on the target Board or falls back to that Board's first column, and Sprint membership is cleared (Backlog on the target Board). Soft-archive also clears Sprint membership. If the Task left an Active Sprint (board move or archive), that remove is a Scope change. Restore from archive returns the Task to the Backlog, not into a Sprint.
_Avoid_: Issue, card (UI only), ticket

**Priority**:
How urgently a Task should be handled relative to others: urgent, high, medium, or low. Default on create is medium. Distinct from Board column status.
_Avoid_: severity (not used), importance (vague)

**Manual order**:
The user-defined sequence of Tasks within a Board column, persisted as each Task's column position. Restored whenever Board sort is Manual (or unset). Distinct from Board sort by field.
_Avoid_: board order (ambiguous with column position among Board columns), rank, sort order (prefer Manual order vs Board sort)

**Board sort**:
A per-viewer display preference that reorders Tasks inside each column by a chosen field and direction (Priority, Deadline, created date, or Title) without changing Manual order. When not Manual, within-column drag reorder is off; moving a Task across columns still updates status (and Manual order for that move as today). Persists until the viewer explicitly changes or clears it.
_Avoid_: filter (filters hide Tasks; Board sort only reorders), Manual order, column sort (Board-wide, not per-column)

**Label**:
A Project-scoped tag attachable to any Task in the Project, regardless of Board. Not owned by a Board.
_Avoid_: Board label, tag (prefer Label)

### Structure

**Parent Task**:
A root Task (no `parent_id`) that has one or more Subtasks. At most one hierarchy level — a Parent Task cannot itself be a Subtask. A Parent Task cannot be moved to the Board's Done column, archived, or hard-deleted while any of its Subtasks are not Done or still exist, respectively. Distinct from a Task Link — hierarchy is parent/child, not peer blocking.
_Avoid_: Epic (no separate Epic type in MVP), issue (Jira term)

**Subtask**:
A full Task that belongs to exactly one Parent Task within the same Project. Created on the Parent's Board by default; may later be moved to another Board in the Project like any Task. Has its own column status, Assignee, Sprint membership, Estimate, and Git branch/PR. Appears on the Kanban as a normal card with a Parent reference badge; viewers may hide Subtasks via a per-viewer Board preference (default: visible). Cannot have its own Subtasks.
_Avoid_: checklist item, sub-issue (UI-only), child issue (prefer Subtask)

**Subtask visibility**:
A per-viewer Board display preference: show Subtasks on the Kanban (default) or hide them so only root Tasks appear. Does not alter Manual order, Sprint membership, or server state.
_Avoid_: Board filter (field-based filters are separate), collapse (UI gesture only)

**Task Link**:
A directed peer relationship between two Tasks in the same Project (any Boards). Stored once; the inverse label is derived in the UI (e.g. A **blocks** B ⇒ B **is blocked by** A). MVP kinds: **blocks** and **relates to**. Self-links and links between a Parent Task and its Subtask are forbidden. Cyclic **blocks** chains are rejected at write time. **blocks** is enforced on the server: a Task cannot enter the Done column while any open blocker exists; the client mirrors the rule before drag/submit.
_Avoid_: dependency (ambiguous with git/CI), issue link (Jira UI term), parent/child (hierarchy is separate)

**blocks**:
A Task Link kind meaning the source Task must be Done before the target Task may enter the Done column. Open blockers surface as a badge on the target's Kanban card.
_Avoid_: blocked by (that is the inverse view of the same link), depends on (passive voice; store **blocks** direction)

**relates to**:
A Task Link kind with no lifecycle enforcement — contextual association only. Symmetric in meaning; one stored direction, both Tasks show the link.
_Avoid_: linked issue (too generic), see also (wiki term)

### Planning

**Sprint**:
A timeboxed container of Tasks on one Board. Owns lifecycle and calendar bounds; does not define columns or workflow — those stay on the Board. A Task is in at most one Sprint at a time (or in the Backlog when unassigned). A Board may have many Sprints over time, including several Drafts at once, but at most one Sprint in the Active state at once. Commitment and completion are always counted by Task. When Tasks carry Fibonacci Estimates, Active badges and Close reports also show points sum and unestimated count (points primary, task count secondary — ADR 0020). Lifecycle states: Draft (planning, not started; dates optional) → Active (in progress; start and end dates required; at most one per Board) → Closed (completed with a Sprint report; Tasks that counted as Sprint completion remain members of that Closed Sprint and are omitted from Kanban's Active Sprint and Entire board filters until membership changes; Sprint history / report lists them) or Canceled (aborted without a full completion report; membership cleared to Backlog). Close does not change Board columns or archive Tasks. Permanent delete of Closed/Canceled history releases remaining member Tasks to the Backlog.
_Avoid_: Iteration, cycle, milestone (different concepts), Team sprint (Sprints are Board-scoped, not Team- or Project-scoped)

**Backlog**:
The set of Tasks on a Board that are not assigned to any Sprint (`sprint_id` absent) — including not assigned to a Closed Sprint. Not a Board column and not a Sprint state. Completed work left on a Closed Sprint is therefore outside the Backlog.
_Avoid_: Backlog column (a column named Backlog is unrelated), icebox

**Sprint completion**:
A Close-Sprint decision: which Tasks in that Sprint count as completed for the Sprint report. Not inferred continuously from Board columns during the Sprint. The close dialog pre-suggests Tasks currently in the Board's Done column (`board_columns.is_done`; falls back to the rightmost column when none is marked); the user confirms or adjusts before the Sprint is closed. Those Tasks remain members of the Closed Sprint for history and are hidden from Kanban filters (Active Sprint and Entire board) until Manager+ moves them to the Backlog or a Draft; the stored completion snapshot used by the report is not rewritten when membership later changes. Field edits on those Tasks remain allowed; new Tasks cannot be added to a Closed Sprint. Permanently deleting Closed Sprint history releases any remaining member Tasks to the Backlog (they become visible on Kanban again).
_Avoid_: Done column (a column is not automatically “completed”), auto-DONE from git merge (separate automation; not the Sprint completion rule)

**Sprint cancel**:
Aborting a Draft or Active Sprint without Sprint completion. All of its Tasks return to the Backlog. Distinct from Close (which records completion and may carry work into another Sprint).
_Avoid_: Close, delete (delete may still apply to empty Drafts as a UI shortcut; cancel is the domain action that clears membership)

**Commitment**:
The snapshot of Task membership taken when a Sprint starts (Draft → Active). The baseline for the Sprint report (committed vs completed) and Board Insights commitment accuracy. Later adds/removes do not rewrite Commitment; they are Scope changes. Point totals displayed on reports use each Task's current Estimate (not a frozen points snapshot). Burndown reconstructs daily remaining from Commitment ± Scope events; Active remaining treats Done-column membership as a proxy until formal Sprint completion at Close.
_Avoid_: Sprint backlog (the live set of Tasks currently in the Sprint)

**Estimate**:
Optional Fibonacci story points on a Task (`1 | 2 | 3 | 5 | 8 | 13 | 21`). Absent/null means unestimated. Editable by Manager+ only. Used for Sprint size badges, Close report points, burndown, and Board Insights KPIs alongside task counts.
_Avoid_: Ideal hours, t-shirt sizes, free-form integers outside the Fibonacci scale

**Velocity**:
Average completed work across the last N Closed Sprints on a Board (default N = 5). Prefers points when any Estimate exists in the window; otherwise task count. Shown on Backlog Insights for all viewers — not a corporate reporting export.
_Avoid_: Throughput (broader), lead time

**Commitment accuracy**:
Completed ÷ committed work over the same Closed-Sprint window as Velocity (macro ratio). Quality companion to Velocity; null when the window's Commitment total is zero.
_Avoid_: Predictability index, SPI (corporate terms)

**Scope change**:
An audited add or remove of a Task from an Active Sprint after Commitment. Recorded as a Sprint event for the report; does not alter the original Commitment snapshot.
_Avoid_: Edit, update (too vague), re-commitment

**Carryover**:
Incomplete Tasks at Close that are moved to the Backlog or into another Sprint (per Task: existing Draft or a newly created Draft). Tasks counted as Sprint completion stay members of the Closed Sprint (they are not carried over and do not enter the Backlog via Close).
_Avoid_: Rollover, spillover

**Member**:
A user who belongs to a Team with one Role. May leave the Team themselves. Owner/Admin may remove Manager, Contributor, or Viewer; only Owner may remove an Admin. The Owner cannot leave — they must transfer ownership first. Membership grants the same Role capabilities on every Project in the Team.
_Avoid_: Collaborator, participant, teammate, Project member

**Role**:
A named permission set granted to a Member on a Team. Member roles: Admin, Manager, Contributor, Viewer. Owner is not a Member Role — see Owner.
_Avoid_: Permission (a Role groups permissions), access level, Project role

**Owner**:
The user referenced by `teams.owner_id`. Full control of the Team, including deleting an empty Team, ownership transfer, granting/revoking Admin, and deleting any Project in the Team. Not stored as a `team_members` row.
_Avoid_: Admin, Project owner

**Admin**:
A Role that manages Members, Invites, Team settings, creating Projects, and Git repo connection on Projects — but cannot delete a Project, delete the Team, transfer ownership, or grant/revoke the Admin Role (Owner only). May invite and assign Manager, Contributor, or Viewer. Also has Manager-level Board/Task powers on every Project in the Team.

**Manager**:
A Role that plans work inside the Team's Projects: creates, edits, and deletes Tasks and Boards; manages Board columns, Base branch, Allowed head patterns, Labels, Estimates (Fibonacci story points), and Sprints (create/edit Draft, Start, Close, Cancel, backlog membership and order). Cannot manage Members, Invites, Git repo connection, Team settings, or create/delete Projects. Cannot delete a Board that still has Tasks, or a Project's last Board.

**Contributor**:
A Role that executes work on any Task in the Team's Projects (status, assignee, git fields, description) and runs the git flow — cannot create or delete root Tasks or Boards, cannot change Board columns, Base branch, Allowed head patterns, Labels, Estimates, or Sprint membership/lifecycle, and cannot Start/Close/Cancel a Sprint. May create Subtasks under an existing Parent Task and create or remove Task Links (including **blocks**). May view Sprints and Sprint reports.
_Avoid_: Developer, Member (too vague), Executor

**Viewer**:
A Role with read-only access to the Team's Projects' Boards, Tasks, and PR statuses.
_Avoid_: Stakeholder, Guest (Guest Mode / Guest Session — not a Team Role)

**Invite**:
A pending offer to join a Team at a chosen Role. **Email** invites are addressed to an email and redeemed when the auth email matches, or the invitee may claim (`claimed_by`) so an Owner/Admin can confirm (ADR 0002/0003). **Open** invites (`kind = open`) have no email binding — any signed-in non-member may redeem until revoke/expire; the invite stays pending and records `redeem_count` (ADR 0019). Delivery is copy-link first (ADR 0002); email-kind invites may also trigger best-effort outbound mail via Edge Function `send-team-invite` (Resend) when secrets are configured. States: pending, accepted, expired, revoked. Expiry is chosen at creation: 1 day, 7 days, 30 days, or never.
_Avoid_: Auth magic link (different mechanism), Project invite, treating Resend as required for invite redeem

### Awareness

**Author**:
The user who created the Task (`author_id`), or who currently holds that field after a transfer. Auto-enrolled as a Watcher when set; may Unwatch. When Author is transferred away, if that user is not also the Assignee, their Watch is removed automatically.
_Avoid_: reporter, creator (UI copy may say “created by”; the domain term is Author)

**Assignee**:
The user currently responsible for executing the Task (`assignee_id`), if any. Distinct from the Contributor Role — Contributors may edit any Task; Assignee is an optional person field. Auto-enrolled as a Watcher when set; may Unwatch. Reassignment or clearing the Assignee removes that user's Watch only if they are not also the Author. Clearing the Assignee (no replacement) creates no Notification.
_Avoid_: executor, owner (Owner is the Team Owner), responsible (too vague)

**Watch**:
A personal subscription by a user to a Task so they receive Notifications for a curated set of structural Task events (not every Activity — e.g. not description, Labels, Sprint membership, or git field edits). Author and Assignee are auto-enrolled; Mentionees are not. Any Team Owner or Member who can view the Task (including Viewer) may Watch or Unwatch. Only that user may add or remove their own Watch — others cannot Unwatch them. Losing both Author and Assignee roles on a Task auto-removes that user's Watch; a Watcher who was never Author or Assignee keeps their Watch until they Unwatch or leave the Team. Watch is independent of always-on person-field and Mention Notifications. Watchers on a Task may be shown as a list (e.g. avatars) for awareness. When the user leaves or is removed from the Team, their Watches on that Team's Projects' Tasks are deleted.
_Avoid_: follow, subscribe, favorite, activity (Activity is the Task drawer feed from `activity_log`)

**Watcher**:
A user who has a Watch on a Task.
_Avoid_: subscriber, follower

**Mention**:
An explicit structured reference to a single Team Owner or Member (including Viewer) inside a Task Description or Comment. Only users who can already view the Task may be Mentionees — not users outside the Team. Group Mentions (`everyone`, whole Roles) are out of scope. Free-text that looks like `@Name` without a structured reference is not a Mention. Always-on awareness: creates a Notification for the Mentionee, independent of Watch. Does not auto-enroll a Watch — Mentionee stays unwatched unless they already Watch or become Author/Assignee. On create or edit, only Mentionees newly added relative to the previous body receive a Notification; Mentionees who remain unchanged across an edit are not re-notified. Removing a Mentionee and adding them again later counts as new. Multiple Mentions of the same Mentionee in one save produce one Notification. Opening a Mention Notification opens the Task; Comment Mentions also target that Comment. If a Mentionee later leaves the Team, the structured reference may remain in the body as a stale Mention (shown without resolving to a current Member) and must not trigger new Notifications until they are a Team Owner or Member again. Resolved by user id, not by a free-text handle. Not the same as commenting in general — a Comment without a Mention notifies nobody via Notification. The actor is never notified for Mentions they create (including self-Mention).
_Avoid_: tag, ping, @user (UI syntax only), comment notification (Comments alone are not a Notification kind), @everyone

**Mentionee**:
The user targeted by a Mention.
_Avoid_: mentioned user, tagged user

**Notification**:
An in-app inbox item addressed to one user about a Task event. Watcher kinds: status change, Board move, priority change, Assignee set/reassign, Author change, Subtask created or closed on a Parent Task the user Watches (`subtask_change`). Always-on kinds (independent of Watch): assignment to the new Assignee, Assignee reassign to the previous Assignee (`assignee_change`), Author transfer to the new Author, and Mention to the Mentionee. On person-field changes, Watchers also receive the corresponding Watcher kind; a recipient who would get both always-on and Watcher delivery for the same change gets a single Notification row. A Board move that also remaps status produces one `board_move` Notification (status included in context), not a separate `status_change`. A single Task save that changes several structural fields produces one Notification per changed kind (not one summary row). Never created for the actor of the change. Clearing Assignee creates none. Watcher kinds are not created for description, title, Labels, Sprint membership, git fields, archive/restore, or Comments without Mentions. Global inbox with optional Project filter; unread until opened; bell in AppChrome opens a recent preview sheet; full history/search lives on `/notifications`. Delivered via Realtime to the recipient for badge/sheet freshness. Not email or push in the MVP. Read Notifications older than 30 days may be purged. Unread Notifications may be kept for up to 90 days, then deleted. UI soft-caps the sheet and paginates the page. Leaving a Team does not delete existing Notification rows for that Team's Projects; opening one without access fails safely and may still mark read. Distinct from Activity (per-Task drawer history shared by all viewers).
_Avoid_: alert, toast (transient UI only), activity event
