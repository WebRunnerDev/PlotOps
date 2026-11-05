import { describe, expect, it } from "vitest";

import {
    isMergeSetComplete,
    type MergeTargetBoard,
    planMergeCompletion,
    resolveMergeTarget,
} from "./merge-sync";

const COLUMNS = [
    { id: "todo", is_done: false, position: 0 },
    { id: "in_review", is_done: false, position: 1 },
    { id: "qa", is_done: false, position: 2 },
    { id: "done", is_done: true, position: 3 },
];

const LAST_COLUMN: MergeTargetBoard = {
    merge_target_column_id: null,
    merge_target_mode: "last_column",
};

describe("resolveMergeTarget", () => {
    it("defaults to the last column (previous behaviour)", () => {
        expect(resolveMergeTarget(LAST_COLUMN, COLUMNS)).toEqual({
            columnId: "done",
            kind: "column",
        });
    });

    it("treats a missing mode as last_column", () => {
        expect(
            resolveMergeTarget(
                { merge_target_column_id: null, merge_target_mode: null },
                COLUMNS
            )
        ).toEqual({ columnId: "done", kind: "column" });
    });

    it("uses the chosen column", () => {
        expect(
            resolveMergeTarget(
                { merge_target_column_id: "qa", merge_target_mode: "column" },
                COLUMNS
            )
        ).toEqual({ columnId: "qa", kind: "column" });
    });

    it("falls back to none when the chosen column was deleted", () => {
        expect(
            resolveMergeTarget(
                { merge_target_column_id: "gone", merge_target_mode: "column" },
                COLUMNS
            )
        ).toEqual({ kind: "none" });
        expect(
            resolveMergeTarget(
                { merge_target_column_id: null, merge_target_mode: "column" },
                COLUMNS
            )
        ).toEqual({ kind: "none" });
    });

    it("reports no_columns only when last_column has nothing to pick", () => {
        expect(resolveMergeTarget(LAST_COLUMN, [])).toEqual({
            kind: "no_columns",
        });
        expect(
            resolveMergeTarget(
                { merge_target_column_id: null, merge_target_mode: "none" },
                []
            )
        ).toEqual({ kind: "none" });
    });
});

describe("isMergeSetComplete", () => {
    const merged = { pr_number: 1, pr_state: "merged" };
    const open = { pr_number: 2, pr_state: "open" };
    const closed = { pr_number: 3, pr_state: "closed" };
    const branchOnly = { pr_number: null, pr_state: null };

    it("waits while any PR is still open", () => {
        expect(isMergeSetComplete([merged, open])).toBe(false);
    });

    it("completes when every PR is merged", () => {
        expect(isMergeSetComplete([merged])).toBe(true);
        expect(
            isMergeSetComplete([merged, { pr_number: 4, pr_state: "merged" }])
        ).toBe(true);
    });

    it("ignores PRs closed without merge and branch-only Git links", () => {
        expect(isMergeSetComplete([merged, closed, branchOnly])).toBe(true);
    });

    it("never completes an empty set", () => {
        expect(isMergeSetComplete([])).toBe(false);
        expect(isMergeSetComplete([closed, branchOnly])).toBe(false);
    });
});

describe("planMergeCompletion", () => {
    const MERGED = [{ pr_number: 42, pr_state: "merged" }];

    it("moves the Task into the chosen column", () => {
        expect(
            plan({ merge_target_column_id: "qa", merge_target_mode: "column" })
        ).toEqual({ kind: "complete", moveTo: "qa" });
    });

    it("moves to the last column for existing Boards", () => {
        expect(plan(LAST_COLUMN)).toEqual({ kind: "complete", moveTo: "done" });
    });

    it("keeps the column in none mode or when the chosen column was deleted", () => {
        expect(
            plan({ merge_target_column_id: null, merge_target_mode: "none" })
        ).toEqual({ kind: "complete", moveTo: null });
        expect(
            plan({
                merge_target_column_id: "gone",
                merge_target_mode: "column",
            })
        ).toEqual({ kind: "complete", moveTo: null });
    });

    it("does not move a Task already sitting in the target column", () => {
        expect(
            plan(
                { merge_target_column_id: "qa", merge_target_mode: "column" },
                { status: "qa" }
            )
        ).toEqual({ kind: "complete", moveTo: null });
    });

    it("keeps the column on Boards without columns", () => {
        expect(plan(LAST_COLUMN, { columns: [] })).toEqual({
            kind: "complete",
            moveTo: null,
        });
    });

    it("is pending while another PR is open", () => {
        expect(
            plan(LAST_COLUMN, {
                links: [...MERGED, { pr_number: 7, pr_state: "open" }],
            })
        ).toEqual({ kind: "pending" });
    });

    function plan(
        board: MergeTargetBoard,
        overrides: {
            columns?: typeof COLUMNS;
            links?: { pr_number: null | number; pr_state: null | string }[];
            status?: string;
        } = {}
    ) {
        return planMergeCompletion({
            board,
            columns: overrides.columns ?? COLUMNS,
            links: overrides.links ?? MERGED,
            status: overrides.status ?? "in_review",
        });
    }
});
