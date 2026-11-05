import { describe, expect, it } from "vitest";

import {
    type CandidateTask,
    extractTaskKeyFromBranch,
    matchTask,
    normalizeBranchName,
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

describe("normalizeBranchName", () => {
    it("strips refs and origin prefixes", () => {
        expect(normalizeBranchName("refs/heads/feature/TASK-1")).toBe(
            "feature/TASK-1"
        );
        expect(normalizeBranchName("origin/fix/BUG-2")).toBe("fix/BUG-2");
    });
});

describe("extractTaskKeyFromBranch", () => {
    it("reads key from feature/fix branch names", () => {
        expect(extractTaskKeyFromBranch("feature/TASK-12-login")).toBe(
            "TASK-12"
        );
        expect(extractTaskKeyFromBranch("fix/BUG-5")).toBe("BUG-5");
        expect(extractTaskKeyFromBranch("main")).toBeNull();
    });
});

describe("matchTask", () => {
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
            matchTask(tasks, {
                headRef: "feature/TASK-9-other",
                prNumber: 7,
            })
        ).toMatchObject({ by: "pr", task: { id: "a" } });
    });

    it("matches by branch_name when pr is unset", () => {
        expect(
            matchTask(tasks, {
                headRef: "feature/TASK-8-auth",
                prNumber: 99,
            })
        ).toMatchObject({ by: "branch", task: { id: "b" } });
    });

    it("matches by task_key in head as last resort", () => {
        expect(
            matchTask(tasks, {
                headRef: "feature/TASK-9-slug",
                prNumber: 99,
            })
        ).toMatchObject({ by: "task_key", task: { id: "c" } });
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
            matchTask(onlyArchived, { headRef: "x", prNumber: 3 })
        ).toBeNull();
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

describe("matchTask across Repositories", () => {
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
        expect(matchTask(webTasks, input)?.task.id).toBe("web-task");
        expect(matchTask(apiTasks, input)?.task.id).toBe("api-task");
    });
});

describe("planGitLinkBinding", () => {
    it("is linked when the PR number matched", () => {
        expect(
            planGitLinkBinding({
                by: "pr",
                task: task({ id: "x", pr_number: 7 }),
            })
        ).toBe("linked");
    });

    it("binds a branch-only Git link on the head branch", () => {
        expect(
            planGitLinkBinding({
                by: "branch",
                task: task({ branch_name: "feature/TASK-1", id: "x" }),
            })
        ).toBe("bind");
    });

    it("never rebinds a Git link holding another PR", () => {
        expect(
            planGitLinkBinding({
                by: "branch",
                task: task({
                    branch_name: "feature/TASK-1",
                    id: "x",
                    pr_number: 3,
                }),
            })
        ).toBe("link_conflict");
        expect(
            planGitLinkBinding({
                by: "task_key",
                task: task({ id: "x", pr_number: 3 }),
            })
        ).toBe("link_conflict");
        expect(
            planGitLinkBinding({
                by: "task_key",
                task: task({ branch_name: "feature/TASK-1-old", id: "x" }),
            })
        ).toBe("link_conflict");
    });

    it("auto-links a task_key match without a Git link", () => {
        expect(
            planGitLinkBinding({ by: "task_key", task: task({ id: "x" }) })
        ).toBe("auto_link");
    });
});
