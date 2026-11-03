import { describe, expect, it } from "vitest";

import type { CandidateTask } from "./match-task";

import {
    type MergeTargetBoard,
    planMergePullRequestSync,
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

function plan(
    matched: CandidateTask,
    board: MergeTargetBoard,
    columns = COLUMNS
) {
    return planMergePullRequestSync(matched, {
        board,
        columns,
        prHtmlUrl: "https://github.com/o/r/pull/42",
        prNumber: 42,
    });
}

function task(partial: Partial<CandidateTask> = {}): CandidateTask {
    return {
        archived_at: null,
        board_id: "board-1",
        branch_name: "feature/TASK-1",
        id: "task-1",
        pr_number: 42,
        pr_state: "open",
        status: "in_review",
        task_key: "TASK-1",
        ...partial,
    };
}

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

describe("planMergePullRequestSync", () => {
    it("moves the Task into the chosen column and marks the PR merged", () => {
        expect(
            plan(task(), {
                merge_target_column_id: "qa",
                merge_target_mode: "column",
            })
        ).toEqual({
            moveTo: "qa",
            skip: false,
            taskId: "task-1",
            update: {
                pr_number: 42,
                pr_state: "merged",
                pr_url: "https://github.com/o/r/pull/42",
            },
        });
    });

    it("keeps the column in none mode but still sets pr_state=merged", () => {
        const result = plan(task(), {
            merge_target_column_id: null,
            merge_target_mode: "none",
        });

        expect(result).toMatchObject({
            moveTo: null,
            skip: false,
            update: { pr_state: "merged" },
        });
    });

    it("keeps the column when the chosen column was deleted", () => {
        const result = plan(task(), {
            merge_target_column_id: "gone",
            merge_target_mode: "column",
        });

        expect(result).toMatchObject({ moveTo: null, skip: false });
    });

    it("moves to the last column for existing Boards", () => {
        expect(plan(task(), LAST_COLUMN)).toMatchObject({
            moveTo: "done",
            skip: false,
        });
    });

    it("does not move a Task already sitting in the target column", () => {
        const result = plan(task({ status: "qa" }), {
            merge_target_column_id: "qa",
            merge_target_mode: "column",
        });

        expect(result).toMatchObject({
            moveTo: null,
            skip: false,
            update: { pr_state: "merged" },
        });
    });

    it("skips a redelivery once the merge is applied", () => {
        expect(
            plan(task({ pr_state: "merged", status: "qa" }), {
                merge_target_column_id: "qa",
                merge_target_mode: "column",
            })
        ).toEqual({ reason: "already_synced", skip: true });
        expect(
            plan(task({ pr_state: "merged" }), {
                merge_target_column_id: null,
                merge_target_mode: "none",
            })
        ).toEqual({ reason: "already_synced", skip: true });
        expect(
            plan(task({ pr_state: "merged", status: "done" }), LAST_COLUMN)
        ).toEqual({ reason: "already_synced", skip: true });
    });

    it("skips Boards without columns in last_column mode", () => {
        expect(plan(task(), LAST_COLUMN, [])).toEqual({
            reason: "no_columns",
            skip: true,
        });
    });
});
