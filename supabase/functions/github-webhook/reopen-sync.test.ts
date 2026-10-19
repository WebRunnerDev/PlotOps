import { describe, expect, it } from "vitest";

import type { CandidateTask } from "./match-task";

import {
    planReopenPullRequestSync,
    shouldHandleReopenedPr,
} from "./reopen-sync";

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

describe("shouldHandleReopenedPr", () => {
    it("accepts reopened", () => {
        expect(
            shouldHandleReopenedPr({
                action: "reopened",
                pull_request: { number: 7 },
            })
        ).toBe(true);
    });

    it("rejects closed and opened actions", () => {
        expect(
            shouldHandleReopenedPr({
                action: "closed",
                pull_request: { number: 7 },
            })
        ).toBe(false);
        expect(
            shouldHandleReopenedPr({
                action: "opened",
                pull_request: { number: 7 },
            })
        ).toBe(false);
    });
});

describe("planReopenPullRequestSync", () => {
    it("sets pr_state open without touching status", () => {
        const plan = planReopenPullRequestSync(
            task({
                id: "t1",
                pr_number: 7,
                pr_state: "closed",
                status: "in_progress",
            }),
            { prHtmlUrl: "https://github.com/o/r/pull/7", prNumber: 7 }
        );

        expect(plan).toEqual({
            skip: false,
            taskId: "t1",
            update: {
                pr_number: 7,
                pr_state: "open",
                pr_url: "https://github.com/o/r/pull/7",
            },
        });
        expect(plan).not.toHaveProperty("status");
        if (!plan.skip) {
            expect(plan.update).not.toHaveProperty("status");
            expect(plan.update).not.toHaveProperty("position");
        }
    });

    it("skips when already open (idempotent)", () => {
        expect(
            planReopenPullRequestSync(
                task({ id: "t1", pr_number: 7, pr_state: "open" }),
                {
                    prHtmlUrl: null,
                    prNumber: 7,
                }
            )
        ).toEqual({ reason: "already_open", skip: true });
    });

    it("does not downgrade merged to open", () => {
        expect(
            planReopenPullRequestSync(
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
            planReopenPullRequestSync(null, {
                prHtmlUrl: null,
                prNumber: 7,
            })
        ).toEqual({ reason: "no_task", skip: true });
    });

    it("does not retarget a task already linked to another PR", () => {
        expect(
            planReopenPullRequestSync(
                task({
                    id: "t1",
                    pr_number: 42,
                    pr_state: "closed",
                    task_key: "TASK-1",
                }),
                {
                    prHtmlUrl: "https://github.com/o/r/pull/99",
                    prNumber: 99,
                }
            )
        ).toEqual({ reason: "pr_mismatch", skip: true });
    });

    it("does not bind an unbound task from a reopen event", () => {
        expect(
            planReopenPullRequestSync(
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
