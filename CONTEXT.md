# PlotOps

Git-oriented CRM (Jira/Linear clone) with GitHub integration. Collaboration and access are scoped to a Project — there is no separate Team entity in the MVP.

## Language

### Ownership & access

**Project**:
The unit of ownership and collaboration. Members, roles, Boards, Tasks, and a linked GitHub repository all belong to a Project.
_Avoid_: Team, Workspace, Organization

**Board**:
A kanban workflow inside a Project: its own columns and Tasks. A Project may have several Boards (e.g. Core, Frontend). Git branch mapping for that workflow belongs to the Board. Every Project has at least one Board. A Board may be deleted only when it has no Tasks and is not the Project's last Board.
_Avoid_: Kanban, workspace board, Team board (Boards are Project-scoped, not Team-scoped)

**Base branch**:
The single Git branch a Board treats as the default PR target (merge destination). Owned by the Board; seeded from the Project's repo default branch when the Board is created, then editable per Board. A Task is considered merge-complete (e.g. auto-DONE) when its PR merges into that Task's Board Base branch — not into an arbitrary project default.
_Avoid_: default branch (that term is the repo/GitHub default on the Project), main (a common value, not the concept)

**Allowed head pattern**:
A glob-like rule on a Board that describes which task head-branch names fit that Board's workflow (e.g. `feature/*`, `fix/CORE-*`). An empty list means any branch is allowed. When patterns exist and a linked/generated name does not match, the product warns and may ask for confirmation — it does not hard-block.
_Avoid_: branch filter, branch whitelist (implies hard deny)

**Task**:
A unit of work that always belongs to exactly one Board (and thus to that Board's Project). May optionally link a Git branch and/or pull request. May optionally belong to one Sprint on that Board. May be moved to another Board in the same Project; on move, status is remapped to a matching column on the target Board or falls back to that Board's first column, and Sprint membership is cleared (Backlog on the target Board). Soft-archive also clears Sprint membership. If the Task left an Active Sprint (board move or archive), that remove is a Scope change. Restore from archive returns the Task to the Backlog, not into a Sprint.
_Avoid_: Issue, card (UI only), ticket

**Label**:
A Project-scoped tag attachable to any Task in the Project, regardless of Board. Not owned by a Board.
_Avoid_: Board label, tag (prefer Label)

### Planning

**Sprint**:
A timeboxed container of Tasks on one Board. Owns lifecycle and calendar bounds; does not define columns or workflow — those stay on the Board. A Task is in at most one Sprint at a time (or in the Backlog when unassigned). A Board may have many Sprints over time, including several Drafts at once, but at most one Sprint in the Active state at once. Commitment and completion for a Sprint are counted by Task, not by estimate points (points / KPI metrics are out of scope for now). Lifecycle states: Draft (planning, not started; dates optional) → Active (in progress; start and end dates required; at most one per Board) → Closed (completed with a Sprint report) or Canceled (aborted without a full completion report).
_Avoid_: Iteration, cycle, milestone (different concepts), Team sprint (Sprints are Board-scoped, not Team- or Project-scoped), story points (deferred)

**Backlog**:
The set of Tasks on a Board that are not assigned to any Sprint (`sprint_id` absent). Not a Board column and not a Sprint state.
_Avoid_: Backlog column (a column named Backlog is unrelated), icebox

**Sprint completion**:
A Close-Sprint decision: which Tasks in that Sprint count as completed for the Sprint report. Not inferred continuously from Board columns during the Sprint. The close dialog pre-suggests Tasks currently in the Board's last column (highest position); the user confirms or adjusts before the Sprint is closed.
_Avoid_: Done column (a column is not automatically “completed”), auto-DONE from git merge (separate automation; not the Sprint completion rule)

**Sprint cancel**:
Aborting a Draft or Active Sprint without Sprint completion. All of its Tasks return to the Backlog. Distinct from Close (which records completion and may carry work into another Sprint).
_Avoid_: Close, delete (delete may still apply to empty Drafts as a UI shortcut; cancel is the domain action that clears membership)

**Commitment**:
The snapshot of Task membership taken when a Sprint starts (Draft → Active). The baseline for the Sprint report (committed vs completed). Later adds/removes do not rewrite Commitment; they are Scope changes.
_Avoid_: Sprint backlog (the live set of Tasks currently in the Sprint), estimate, points

**Scope change**:
An audited add or remove of a Task from an Active Sprint after Commitment. Recorded as a Sprint event for the report; does not alter the original Commitment snapshot.
_Avoid_: Edit, update (too vague), re-commitment

**Carryover**:
Incomplete Tasks at Close that are moved to the Backlog or into another Sprint (existing Draft or a newly created Draft). Completed Tasks are recorded on the closed Sprint and are not carried over.
_Avoid_: Rollover, spillover

**Member**:
A user who belongs to a Project with one Role. May leave the Project themselves. Owner/Admin may remove Manager, Contributor, or Viewer; only Owner may remove an Admin. The Owner cannot leave — they must transfer ownership first.
_Avoid_: Collaborator, participant, teammate

**Role**:
A named permission set granted to a Member on a Project. MVP member roles: Admin, Manager, Contributor, Viewer. Owner is not a Member Role — see Owner.
_Avoid_: Permission (a Role groups permissions), access level

**Owner**:
The user referenced by `projects.owner_id`. Full control of the Project, including deletion, ownership transfer, and granting/revoking Admin. Not stored as a `project_members` row.
_Avoid_: Admin

**Admin**:
A Role that manages Members, Invites, Project settings, and Git repo connection — but cannot delete the Project, transfer ownership, or grant/revoke the Admin Role (Owner only). May invite and assign Manager, Contributor, or Viewer. Also has Manager-level Board/Task powers.

**Manager**:
A Role that plans work: creates, edits, and deletes Tasks and Boards; manages Board columns, Base branch, Allowed head patterns, Labels, and Sprints (create/edit Draft, Start, Close, Cancel, backlog membership and order). Cannot manage Members, Invites, Git repo connection, or Project settings. Cannot delete a Board that still has Tasks, or the Project's last Board.

**Contributor**:
A Role that executes work on any Task in the Project (status, assignee, git fields, description) and runs the git flow — cannot create or delete Tasks or Boards, cannot change Board columns, Base branch, Allowed head patterns, Labels, or Sprint membership/lifecycle, and cannot Start/Close/Cancel a Sprint. May view Sprints and Sprint reports.
_Avoid_: Developer, Member (too vague), Executor

**Viewer**:
A Role with read-only access to the Project's Boards, Tasks, and PR statuses.
_Avoid_: Stakeholder, Guest (Guest is the demo auth mode, not a Project Role)

**Invite**:
A pending offer to join a Project at a chosen Role, addressed to an email. Delivered as a copyable token link in-app — not sent by email in the MVP. States: pending, accepted, expired, revoked. Redeem requires the auth email to match, or the invitee may claim the invite (`claimed_by`) so an Owner/Admin can confirm. Expiry is chosen at creation: 1 day, 7 days, 30 days, or never.
_Avoid_: Invitation email (delivery is out-of-band), magic link (Auth magic links are a different mechanism)
