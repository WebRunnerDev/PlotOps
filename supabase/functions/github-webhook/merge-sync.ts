import {
    type BoardColumnRow,
    type CandidateTask,
    isAlreadySynced,
    pickLastColumnId,
} from "./match-task.ts";

export type MergePullRequestPlan =
    | {
          /** Column the Task moves into; `null` when the column stays as is. */
          moveTo: null | string;
          skip: false;
          taskId: string;
          update: {
              pr_number: number;
              pr_state: "merged";
              pr_url: null | string;
          };
      }
    | { reason: string; skip: true };

export type MergeTarget =
    | { columnId: string; kind: "column" }
    | { kind: "no_columns" }
    | { kind: "none" };

/** Board merge setting (`boards.merge_target_*`). */
export type MergeTargetBoard = {
    merge_target_column_id: null | string;
    merge_target_mode: null | string;
};

/**
 * Decide the Task update for a PR merged into the Board's Base branch.
 * Idempotent: a redelivery of an already-applied merge is skipped.
 */
export function planMergePullRequestSync(
    matched: CandidateTask,
    input: {
        board: MergeTargetBoard;
        columns: BoardColumnRow[];
        prHtmlUrl: null | string;
        prNumber: number;
    }
): MergePullRequestPlan {
    const target = resolveMergeTarget(input.board, input.columns);
    if (target.kind === "no_columns") {
        return { reason: "no_columns", skip: true };
    }

    const targetColumnId = target.kind === "column" ? target.columnId : null;
    if (isAlreadySynced(matched, targetColumnId)) {
        return { reason: "already_synced", skip: true };
    }

    return {
        moveTo:
            targetColumnId !== null && matched.status !== targetColumnId
                ? targetColumnId
                : null,
        skip: false,
        taskId: matched.id,
        update: {
            pr_number: input.prNumber,
            pr_state: "merged",
            pr_url: input.prHtmlUrl,
        },
    };
}

/**
 * `last_column` (default) → highest position; `column` → the chosen column,
 * or `none` when it no longer exists on the Board; `none` → no move.
 */
export function resolveMergeTarget(
    board: MergeTargetBoard,
    columns: BoardColumnRow[]
): MergeTarget {
    if (board.merge_target_mode === "none") {
        return { kind: "none" };
    }

    if (board.merge_target_mode === "column") {
        const column = columns.find(
            (item) => item.id === board.merge_target_column_id
        );
        return column
            ? { columnId: column.id, kind: "column" }
            : { kind: "none" };
    }

    const lastColumnId = pickLastColumnId(columns);
    return lastColumnId
        ? { columnId: lastColumnId, kind: "column" }
        : { kind: "no_columns" };
}
