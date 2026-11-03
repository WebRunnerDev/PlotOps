# Configurable merge target column per Development Board

`github-webhook` used to move a Task to its Board's **last column** (highest `position`) as soon as its PR merged into the Board's Base branch. Merged code can still be broken, so the Task looked finished before anyone had checked it. Teams with a QA / "Ready to test" step had no way to stop the jump.

## Decision

- **Per-Board setting** on `boards`: `merge_target_mode` (`last_column` | `column` | `none`, default `last_column`) and nullable `merge_target_column_id`. A check constraint ties them together: `column` ⇔ a target column is set.
- **`last_column` is the default**, so existing Boards keep the previous behaviour without a backfill.
- **`column`** moves the Task into the chosen column (e.g. _QA_). **`none`** leaves the column alone; the webhook still sets `pr_state = merged`.
- **Same-Board FK.** `(id, merge_target_column_id) → board_columns (board_id, id)` with `on delete set null (merge_target_column_id)`. A `before update` trigger then flips the mode from `column` to `none`. Deleting the target column therefore stops moves on merge, rather than quietly falling back to the last column. The webhook applies the same rule if it ever finds a `column` mode whose column is missing.
- **Idempotency follows the target.** A delivery is already applied when `pr_state = merged` and the Task is in the target column, or in any column when the mode is `none`. A Task already sitting in the target column only gets its PR fields updated.
- **History and notifications only on a real move.** The `activity_log` row (`user_id = null`) always records the PR change and includes a `status` change only when the column changed. `create_notifications_for_status_change` runs only on a move. The Subtask `closed` notice to the Parent now follows the app rule: the Subtask entered a Done column it was not already in. Before, it fired on any move to the last column.
- **UI:** Project Settings → Boards, inside the Development Board fields. Those fields appear only when a repository is linked and the page is shown only to Manager+. Guest Mode stores the setting in the sandbox and mirrors the column-delete fallback. Guests cannot merge PRs, so there is no local merge path to change.

## Rejected

- **Falling back to the last column when the target is deleted.** That would bring back the exact premature-close behaviour this setting exists to avoid, and nobody would notice.
- **Using the `is_done` column as the merge target.** `is_done` drives Close Sprint pre-checks. Tying merge sync to it would stop a Board from having a QA column that merges land in while Done stays the end of the workflow.
- **A free-text column id with no FK.** Stale ids would build up after column deletes, and the webhook would be the only thing checking them.
