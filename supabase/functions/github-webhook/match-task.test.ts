import { describe, expect, it } from "vitest";

import {
    type CandidateTask,
    matchTasks,
    pickLastColumnId,
    planGitLinkBinding,
} from "./match-task";

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

const ids = (matches: ReturnType<typeof matchTasks>) =>
    matches.map((match) => [match.by, match.task.id]);

describe("matchTasks", () => {
    const tasks = [
        task({ id: "a", pr_number: 7, task_key: "TASK-7" }),
        task({
            branch_name: "feature/TASK-8-auth",
            id: "b",
            task_key: "TASK-8",
        }),
        task({ id: "c", task_key: "TASK-9" }),
        task({
            archived_at: "2026-01-01T00:00:00Z",
            id: "archived",
            pr_number: 7,
            task_key: "TASK-7",
        }),
    ];

    it("matches by pr_number first", () => {
        expect(
            matchTasks(tasks, { headRef: "feature/x", prNumber: 7 })[0]
        ).toMatchObject({ by: "pr", task: { id: "a" } });
    });

    it("matches by branch_name when the PR is not linked", () => {
        expect(
            ids(
                matchTasks(tasks, {
                    headRef: "feature/TASK-8-auth",
                    prNumber: 99,
                })
            )
        ).toEqual([["branch", "b"]]);
    });

    it("keeps the strongest match per Task", () => {
        expect(
            ids(matchTasks(tasks, { headRef: "feature/TASK-7-x", prNumber: 7 }))
        ).toEqual([["pr", "a"]]);
    });

    it("finds a task key anywhere in the head branch", () => {
        for (const headReference of [
            "feature/TASK-9-slug",
            "TASK-9-login",
            "user/foo-task-9",
        ]) {
            expect(
                matchTasks(tasks, { headRef: headReference, prNumber: 99 })[0]
            ).toMatchObject({
                by: "task_key",
                key: expect.any(String),
                task: { id: "c" },
            });
        }
    });

    it("finds task keys in the PR title and body", () => {
        expect(
            ids(
                matchTasks(tasks, {
                    body: "Also closes task-8.",
                    headRef: "fix-login",
                    prNumber: 99,
                    title: "TASK-9: Fix login",
                })
            )
        ).toEqual([
            ["task_key", "c"],
            ["task_key", "b"],
        ]);
    });

    it("matches a branch event without a PR number", () => {
        expect(ids(matchTasks(tasks, { headRef: "TASK-9-login" }))).toEqual([
            ["task_key", "c"],
        ]);
    });

    it("ignores archived tasks", () => {
        const onlyArchived = [
            task({
                archived_at: "2026-01-01T00:00:00Z",
                id: "archived",
                pr_number: 3,
                task_key: "TASK-3",
            }),
        ];
        expect(
            matchTasks(onlyArchived, { headRef: "TASK-3", prNumber: 3 })
        ).toEqual([]);
    });
});

describe("pickLastColumnId", () => {
    it("returns the highest-position column id", () => {
        expect(
            pickLastColumnId([
                { id: "todo", position: 0 },
                { id: "done", position: 3 },
                { id: "in_progress", position: 1 },
            ])
        ).toBe("done");
    });

    it("returns null for empty columns", () => {
        expect(pickLastColumnId([])).toBeNull();
    });
});

describe("matchTasks across Repositories", () => {
    // Candidates carry only the Git link to the delivering Repository, so the
    // same PR number in another Repository is invisible here.
    const webTasks = [
        task({ id: "web-task", pr_number: 12, task_key: "TASK-1" }),
        task({ id: "api-task", task_key: "TASK-2" }),
    ];
    const apiTasks = [
        task({ id: "web-task", task_key: "TASK-1" }),
        task({ id: "api-task", pr_number: 12, task_key: "TASK-2" }),
    ];

    it("maps equal PR numbers in two Repositories to different Tasks", () => {
        const input = { headRef: "feature/no-key", prNumber: 12 };
        expect(ids(matchTasks(webTasks, input))).toEqual([["pr", "web-task"]]);
        expect(ids(matchTasks(apiTasks, input))).toEqual([["pr", "api-task"]]);
    });
});

describe("planGitLinkBinding", () => {
    const pr = { headRef: "feature/TASK-1", prNumber: 7 };

    it("is linked when the PR number matched", () => {
        expect(
            planGitLinkBinding(
                { by: "pr", task: task({ id: "x", pr_number: 7 }) },
                pr
            )
        ).toBe("linked");
    });

    it("binds a branch-only Git link on the head branch", () => {
        expect(
            planGitLinkBinding(
                {
                    by: "branch",
                    task: task({ branch_name: "feature/TASK-1", id: "x" }),
                },
                pr
            )
        ).toBe("bind");
    });

    it("is linked when a branch event finds its own branch", () => {
        expect(
            planGitLinkBinding(
                {
                    by: "branch",
                    task: task({ branch_name: "feature/TASK-1", id: "x" }),
                },
                { headRef: "feature/TASK-1" }
            )
        ).toBe("linked");
    });

    it("never rebinds a Git link holding another PR or branch", () => {
        expect(
            planGitLinkBinding(
                {
                    by: "branch",
                    task: task({
                        branch_name: "feature/TASK-1",
                        id: "x",
                        pr_number: 3,
                    }),
                },
                pr
            )
        ).toBe("link_conflict");
        expect(
            planGitLinkBinding(
                { by: "task_key", task: task({ id: "x", pr_number: 3 }) },
                pr
            )
        ).toBe("link_conflict");
        expect(
            planGitLinkBinding(
                {
                    by: "task_key",
                    task: task({ branch_name: "feature/TASK-1-old", id: "x" }),
                },
                { headRef: "TASK-1-new" }
            )
        ).toBe("link_conflict");
    });

    it("auto-links a task key match without a Git link", () => {
        expect(
            planGitLinkBinding({ by: "task_key", task: task({ id: "x" }) }, pr)
        ).toBe("auto_link");
    });

    it("never brings back a PR or branch a person unlinked", () => {
        expect(
            planGitLinkBinding(
                { by: "task_key", task: task({ dismissed_prs: [7], id: "x" }) },
                pr
            )
        ).toBe("dismissed");
        expect(
            planGitLinkBinding(
                {
                    by: "task_key",
                    task: task({
                        dismissed_branches: ["feature/TASK-1"],
                        id: "x",
                    }),
                },
                { headRef: "refs/heads/feature/TASK-1" }
            )
        ).toBe("dismissed");
        expect(
            planGitLinkBinding(
                {
                    by: "branch",
                    task: task({
                        branch_name: "feature/TASK-1",
                        dismissed_prs: [7],
                        id: "x",
                    }),
                },
                pr
            )
        ).toBe("dismissed");
        expect(
            planGitLinkBinding(
                { by: "task_key", task: task({ dismissed_prs: [8], id: "x" }) },
                pr
            )
        ).toBe("auto_link");
    });
});
