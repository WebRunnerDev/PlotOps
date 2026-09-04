import { describe, expect, it } from "vitest";

import type { CandidateTask } from "./match-task";

import {
    planClosePullRequestSync,
    shouldHandleClosedUnmergedPr,
} from "./close-sync";

function task(
    partial: Partial<CandidateTask> & Pick<CandidateTask, "id">
): CandidateTask {
    return {
        archived_at: null,
        board_id: "board-1",
        branch_name: null,
        pr_number: null,
        pr_state: null,
        status: "todo",
        task_key: "TASK-1",
        ...partial,
    };
}

describe("shouldHandleClosedUnmergedPr", () => {
    it("accepts closed + merged false", () => {
        expect(
            shouldHandleClosedUnmergedPr({
                action: "closed",
                pull_request: { merged: false, number: 7 },
            })
        ).toBe(true);
    });

    it("rejects merge closes and non-closed actions", () => {
        expect(
            shouldHandleClosedUnmergedPr({
                action: "closed",
                pull_request: { merged: true, number: 7 },
            })
        ).toBe(false);
        expect(
            shouldHandleClosedUnmergedPr({
                action: "opened",
                pull_request: { merged: false, number: 7 },
            })
        ).toBe(false);
    });
});

describe("planClosePullRequestSync", () => {
    it("sets pr_state closed without touching status", () => {
        const plan = planClosePullRequestSync(
            task({
                id: "t1",
                pr_number: 7,
                pr_state: "open",
                status: "in_progress",
            }),
            { prHtmlUrl: "https://github.com/o/r/pull/7", prNumber: 7 }
        );

        expect(plan).toEqual({
            skip: false,
            taskId: "t1",
            update: {
                pr_number: 7,
                pr_state: "closed",
                pr_url: "https://github.com/o/r/pull/7",
            },
        });
        expect(plan).not.toHaveProperty("status");
        if (!plan.skip) {
            expect(plan.update).not.toHaveProperty("status");
            expect(plan.update).not.toHaveProperty("position");
        }
    });

    it("skips when already closed (idempotent)", () => {
        expect(
            planClosePullRequestSync(
                task({ id: "t1", pr_number: 7, pr_state: "closed" }),
                {
                    prHtmlUrl: null,
                    prNumber: 7,
                }
            )
        ).toEqual({ reason: "already_closed", skip: true });
    });

    it("does not downgrade merged to closed", () => {
        expect(
            planClosePullRequestSync(
                task({
                    id: "t1",
                    pr_number: 7,
                    pr_state: "merged",
                    status: "done",
                }),
                { prHtmlUrl: null, prNumber: 7 }
            )
        ).toEqual({ reason: "already_merged", skip: true });
    });

    it("skips when no matched task", () => {
        expect(
            planClosePullRequestSync(null, {
                prHtmlUrl: null,
                prNumber: 7,
            })
        ).toEqual({ reason: "no_task", skip: true });
    });

    it("does not retarget a task already linked to another PR", () => {
        expect(
            planClosePullRequestSync(
                task({
                    id: "t1",
                    pr_number: 42,
                    pr_state: "open",
                    task_key: "TASK-1",
                }),
                {
                    prHtmlUrl: "https://github.com/o/r/pull/99",
                    prNumber: 99,
                }
            )
        ).toEqual({ reason: "pr_mismatch", skip: true });
    });

    it("does not bind an unbound task from a close event", () => {
        expect(
            planClosePullRequestSync(
                task({
                    id: "t1",
                    pr_number: null,
                    pr_state: null,
                    task_key: "TASK-1",
                }),
                {
                    prHtmlUrl: "https://github.com/o/r/pull/99",
                    prNumber: 99,
                }
            )
        ).toEqual({ reason: "pr_mismatch", skip: true });
    });
});
