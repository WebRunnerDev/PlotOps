# Subtasks are full Tasks; peer links are typed and Project-scoped

PlotOps needs Jira-like breakdown and blocking without inventing a second work type. A **Subtask** is a full Task with `parent_id` (one level, same Project). Peer relationships are **Task Links** (`blocks`, `relates to`) between two Tasks in the same Project — not Parent/Subtask restated as a link.

## Decision

- **Hierarchy, not a checklist.** Subtask has its own column, Assignee, Sprint, Estimate, and Git branch/PR. Created on the Parent Task’s Board; later Board moves follow existing Task-move rules. No Epic type; no nested Subtasks.
- **Task Links are a separate table**, directed, inverse label derived in UI. Self-links, Parent↔Subtask links, and cyclic **blocks** chains are rejected at write time.
- **Done is gated on the server** (`persist_task_moves` and equivalents): a Task cannot enter the Done column while it has open **blocks** blockers or (if it is a Parent Task) while any Subtask is not Done. Client mirrors the rule for toast/UX. Archive and hard-delete of a Parent Task are refused while Subtasks exist.
- **Contributor exception:** Contributors still cannot create root Tasks, but they may create Subtasks and create/remove Task Links (including **blocks**). Delete/archive of Tasks stays Manager+.
- **Watcher kind `subtask_change`:** Watchers of the Parent Task are notified when a Subtask is created or closed. This reopens the curated Watcher set in ADR 0011 for this one kind. Task Link changes stay in Activity only.
- **Guest Mode** seeds example Parent/Subtask and Task Links in the local sandbox (ADR 0018).

## Rejected

- Checklist items that are not Tasks (cheaper UI, but breaks git/Sprint/Assignee and the glossary’s Task).
- Unlimited nesting or a separate Epic type (Kanban and RLS complexity for an MVP).
- Client-only enforcement (Guest and Contributors could bypass Done/archive rules).
- Estimate rollup onto the Parent Task (easy to add later; independent Estimates stay honest).
- Always-on Notifications for **blocks** (badge + Activity is enough for MVP).
