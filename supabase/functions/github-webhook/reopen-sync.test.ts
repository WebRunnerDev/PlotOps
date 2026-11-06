import { describe, expect, it } from "vitest";

import type { CandidateTask, MatchedBy, TaskMatch } from "./match-task";

import {
    planReopenPullRequestSync,
    shouldHandleReopenedPr,
} from "./reopen-sync";

type TaskFixture = Partial<CandidateTask> &
    Pick<CandidateTask, "id"> & {
        /** Shorthand for a single Git link in this Repository. */
        branch_name?: null | string;
        pr_number?: null | number;
        pr_state?: null | string;
    };

function match(partial: TaskFixture, by: MatchedBy = "pr"): TaskMatch {
    const candidate = task(partial);
    return {
        by,
        link: by === "task_key" ? undefined : candidate.git_links[0],
        task: candidate,
    };
}

function task({
    branch_name = null,
    pr_number = null,
    pr_state = null,
    ...partial
}: TaskFixture): CandidateTask {
    return {
        archived_at: null,
        board_id: "board-1",
        git_links:
            branch_name != undefined || pr_number != undefined
                ? [
                      {
                          branch_name,
                          id: `${partial.id}-link`,
                          pr_number,
                          pr_state,
                      },
                  ]
                : [],
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
            {
                headRef: "feature/no-key",
                prHtmlUrl: "https://github.com/o/r/pull/7",
                prNumber: 7,
            }
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
                    headRef: "feature/no-key",
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
                { headRef: "feature/no-key", prHtmlUrl: null, prNumber: 7 }
            )
        ).toEqual({ reason: "already_merged", skip: true });
    });

    it("skips when no matched task", () => {
        expect(
            planReopenPullRequestSync(null, {
                headRef: "feature/no-key",
                prHtmlUrl: null,
                prNumber: 7,
            })
        ).toEqual({ reason: "no_task", skip: true });
    });

    it("adds a new Git link next to one holding another PR", () => {
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
                    headRef: "feature/no-key",
                    prHtmlUrl: "https://github.com/o/r/pull/99",
                    prNumber: 99,
                }
            )
        ).toMatchObject({ binding: "auto_link", skip: false });
    });

    it("adds a new Git link next to a branch-only one on another branch", () => {
        expect(
            planReopenPullRequestSync(
                match(
                    { branch_name: "feature/TASK-1-old", id: "t1" },
                    "task_key"
                ),
                { headRef: "feature/no-key", prHtmlUrl: null, prNumber: 99 }
            )
        ).toMatchObject({ binding: "auto_link", skip: false });
    });

    it("binds the PR to a branch-only Git link on the head branch", () => {
        expect(
            planReopenPullRequestSync(
                match({ branch_name: "feature/TASK-1", id: "t1" }, "branch"),
                { headRef: "feature/no-key", prHtmlUrl: null, prNumber: 99 }
            )
        ).toMatchObject({ binding: "bind", skip: false });
    });

    it("auto-links a Task matched only by task_key without a Git link", () => {
        expect(
            planReopenPullRequestSync(match({ id: "t1" }, "task_key"), {
                headRef: "feature/no-key",
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
