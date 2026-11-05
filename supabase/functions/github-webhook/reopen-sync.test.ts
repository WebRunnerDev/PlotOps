import { describe, expect, it } from "vitest";

import type { CandidateTask, MatchedBy, TaskMatch } from "./match-task";

import {
    planReopenPullRequestSync,
    shouldHandleReopenedPr,
} from "./reopen-sync";

function match(
    partial: Partial<CandidateTask> & Pick<CandidateTask, "id">,
    by: MatchedBy = "pr"
): TaskMatch {
    return { by, task: task(partial) };
}

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
            match({
                id: "t1",
                pr_number: 7,
                pr_state: "closed",
                status: "in_progress",
            }),
            { prHtmlUrl: "https://github.com/o/r/pull/7", prNumber: 7 }
        );

        expect(plan).toEqual({
            binding: "linked",
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
                match({ id: "t1", pr_number: 7, pr_state: "open" }),
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
                match({
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

    it("does not overwrite a Git link holding another PR", () => {
        expect(
            planReopenPullRequestSync(
                match(
                    {
                        id: "t1",
                        pr_number: 42,
                        pr_state: "open",
                        task_key: "TASK-1",
                    },
                    "task_key"
                ),
                {
                    prHtmlUrl: "https://github.com/o/r/pull/99",
                    prNumber: 99,
                }
            )
        ).toEqual({ reason: "link_conflict", skip: true });
    });

    it("does not overwrite a branch-only Git link on another branch", () => {
        expect(
            planReopenPullRequestSync(
                match(
                    { branch_name: "feature/TASK-1-old", id: "t1" },
                    "task_key"
                ),
                { prHtmlUrl: null, prNumber: 99 }
            )
        ).toEqual({ reason: "link_conflict", skip: true });
    });

    it("binds the PR to a branch-only Git link on the head branch", () => {
        expect(
            planReopenPullRequestSync(
                match({ branch_name: "feature/TASK-1", id: "t1" }, "branch"),
                { prHtmlUrl: null, prNumber: 99 }
            )
        ).toMatchObject({ binding: "bind", skip: false });
    });

    it("auto-links a Task matched only by task_key without a Git link", () => {
        expect(
            planReopenPullRequestSync(match({ id: "t1" }, "task_key"), {
                prHtmlUrl: "https://github.com/o/r/pull/99",
                prNumber: 99,
            })
        ).toEqual({
            binding: "auto_link",
            skip: false,
            taskId: "t1",
            update: {
                pr_number: 99,
                pr_state: "open",
                pr_url: "https://github.com/o/r/pull/99",
            },
        });
    });
});
