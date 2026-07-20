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
A unit of work that always belongs to exactly one Board (and thus to that Board's Project). May optionally link a Git branch and/or pull request. May be moved to another Board in the same Project; on move, status is remapped to a matching column on the target Board or falls back to that Board's first column.
_Avoid_: Issue, card (UI only), ticket

**Label**:
A Project-scoped tag attachable to any Task in the Project, regardless of Board. Not owned by a Board.
_Avoid_: Board label, tag (prefer Label)

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
A Role that plans work: creates, edits, and deletes Tasks and Boards; manages Board columns, Base branch, Allowed head patterns, and Labels. Cannot manage Members, Invites, Git repo connection, or Project settings. Cannot delete a Board that still has Tasks, or the Project's last Board.

**Contributor**:
A Role that executes work on any Task in the Project (status, assignee, git fields, description) and runs the git flow — cannot create or delete Tasks or Boards, and cannot change Board columns, Base branch, Allowed head patterns, or Labels.
_Avoid_: Developer, Member (too vague), Executor

**Viewer**:
A Role with read-only access to the Project's Boards, Tasks, and PR statuses.
_Avoid_: Stakeholder, Guest (Guest is the demo auth mode, not a Project Role)

**Invite**:
A pending offer to join a Project at a chosen Role, addressed to an email. Delivered as a copyable token link in-app — not sent by email in the MVP. States: pending, accepted, expired, revoked. Redeem requires the auth email to match, or the invitee may claim the invite (`claimed_by`) so an Owner/Admin can confirm. Expiry is chosen at creation: 1 day, 7 days, 30 days, or never.
_Avoid_: Invitation email (delivery is out-of-band), magic link (Auth magic links are a different mechanism)
