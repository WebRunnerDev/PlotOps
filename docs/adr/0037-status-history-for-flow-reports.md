# Status history for flow reports

Flow reports (STORY-160) need every column change of every Task: Cumulative flow counts Tasks per column by day, Cycle time measures from first leaving the first column to entering Done. `activity_log` already records status changes, but its own migration calls it a context log, "not a full audit trail", written best-effort by each client:

- the MCP worker's `change_task_status` RPC never writes it;
- Subtasks moved along with their Parent Task to another Board are not logged;
- the client swallows a failed insert so the move itself never fails.

A report built on it would silently miss moves.

## Decision

- **A trigger records status history in its own table.** `task_status_changes` gets one row per Task insert and per update of `status` or `board_id` (`tasks_record_status_change`, `after insert or update of status, board_id`). Every write path is covered without touching it: Kanban drag, Task drawer, MCP, GitHub merge sync, Board move, restore from archive, column delete.
    - A row with `from_status` null is the Task's creation.
    - Column names are snapshots taken by the trigger, so history from another Board can be mapped onto the current Board's columns by name.
    - The trigger function is `security definer`; the table has a select policy (`can_view_project`) and no write grants for `authenticated`.
- **`activity_log` stays the drawer's Activity feed**, unchanged. Its status changes were backfilled once into `task_status_changes` (`source = 'activity_log'`); a missing column id is resolved by name on the Task's current Board.
- **Reports read one RPC.** `get_board_flow_history(board, since)` returns jsonb with the Board's non-Epic Tasks (except those archived before `since`) and the full history of every Task that changed since `since` (Cycle time needs the start, which may be earlier). jsonb avoids the PostgREST row cap. `security invoker`, so RLS applies.
- **Aggregation happens on the client**, in pure functions shared with Guest Mode (`src/features/flow-reports/model`). A Board's history in a 90-day window is small (Tasks × a few moves).
- **Mapping and gaps.**
    - A status from another Board maps onto this Board's columns: same id and name, then same name, then same id, else the first column.
    - Done is the column marked Done, else the rightmost (as Close Sprint).
    - A Task whose start predates the recorded history gets no Cycle time; the report says how many.
- **Guest Mode mirrors the trigger** in `writeGuestSandbox`: it compares Task status and Board before and after each write. A new Guest Session gets demo history relative to today, so the reports are not empty.

## Consequences

- History is complete only from this migration on; older moves are as complete as `activity_log` was.
- The Flow tab lives on the Sprints page (`?view=flow`) instead of a renamed "Reports" page, so the Sprints page keeps its name and "Reports page (Jira)" stays an avoided term.
