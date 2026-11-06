import { type BoardColumnRow, pickLastColumnId } from "./match-task.ts";

/** PR fields of one Git link, as merge sync counts them. */
export type GitLinkPrState = {
    pr_number: null | number;
    pr_state: null | string;
};

export type MergeCompletionPlan =
    | {
          kind: "complete";
          /** Column the Task moves into; `null` when the column stays as is. */
          moveTo: null | string;
      }
    | { kind: "pending" };

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
 * ADR 0035 «Merge sync waits for all PRs»: the set is the Task's Git links
 * that hold a PR not closed without merge (branch-only links and closed PRs do
 * not count). It is complete when it is non-empty and every PR in it is
 * merged. A PR merged outside the Base branch never reaches `merged` here, so
 * it keeps the set pending.
 */
export function isMergeSetComplete(links: GitLinkPrState[]): boolean {
    const counted = links.filter(
        (link) => link.pr_number != undefined && link.pr_state !== "closed"
    );
    return (
        counted.length > 0 &&
        counted.every((link) => link.pr_state === "merged")
    );
}

/**
 * Decide whether the Task moves to its Board's merge target column (ADR 0033)
 * now that `links` (all of its Git links, after this event) are known.
 */
export function planMergeCompletion(input: {
    board: MergeTargetBoard;
    columns: BoardColumnRow[];
    links: GitLinkPrState[];
    status: string;
}): MergeCompletionPlan {
    if (!isMergeSetComplete(input.links)) {
        return { kind: "pending" };
    }

    const target = resolveMergeTarget(input.board, input.columns);
    const targetColumnId = target.kind === "column" ? target.columnId : null;

    return {
        kind: "complete",
        moveTo:
            targetColumnId !== null && input.status !== targetColumnId
                ? targetColumnId
                : null,
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
