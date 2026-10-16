import { describe, expect, it } from "vitest";

import {
    type CandidateTask,
    extractTaskKeyFromBranch,
    isAlreadySynced,
    matchBoundTask,
    matchTask,
    normalizeBranchName,
    pickLastColumnId,
    pickProjectTaskForWebhook,
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
            })?.id
        ).toBe("a");
    });

    it("matches by branch_name when pr is unset", () => {
        expect(
            matchTask(tasks, {
                headRef: "feature/TASK-8-auth",
                prNumber: 99,
            })?.id
        ).toBe("b");
    });

    it("matches by task_key in head as last resort", () => {
        expect(
            matchTask(tasks, {
                headRef: "feature/TASK-9-slug",
                prNumber: 99,
            })?.id
        ).toBe("c");
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

describe("pickProjectTaskForWebhook", () => {
    const input = {
        headRef: "feature/TASK-12-login",
        prNumber: 42,
    };

    const colliding = task({
        id: "other-team-task",
        task_key: "TASK-12",
    });
    const bound = task({
        id: "bound-task",
        pr_number: 42,
        pr_state: "open",
        task_key: "TASK-12",
    });

    it("prefers the Project that already has this PR over an earlier task-key hit", () => {
        const picked = pickProjectTaskForWebhook(
            [
                { projectId: "team-a", tasks: [colliding] },
                { projectId: "team-b", tasks: [bound] },
            ],
            input,
            "merge"
        );

        expect(picked).toEqual({ projectId: "team-b", task: bound });
    });

    it("keeps the first branch or task-key match when the PR is not linked yet", () => {
        const picked = pickProjectTaskForWebhook(
            [
                { projectId: "team-a", tasks: [colliding] },
                {
                    projectId: "team-b",
                    tasks: [task({ id: "also-12", task_key: "TASK-12" })],
                },
            ],
            input,
            "merge"
        );

        expect(picked?.projectId).toBe("team-a");
        expect(picked?.task.id).toBe("other-team-task");
    });

    it("close and reopen ignore task-key fall-throughs and still find a later binding", () => {
        const picked = pickProjectTaskForWebhook(
            [
                { projectId: "team-a", tasks: [colliding] },
                { projectId: "team-b", tasks: [bound] },
            ],
            input,
            "pr_state"
        );

        expect(picked).toEqual({ projectId: "team-b", task: bound });
    });

    it("close and reopen skip when no Project has this PR linked", () => {
        expect(
            pickProjectTaskForWebhook(
                [{ projectId: "team-a", tasks: [colliding] }],
                input,
                "pr_state"
            )
        ).toBeNull();
    });

    it("does not treat an archived binding as the target", () => {
        expect(
            matchBoundTask(
                [
                    task({
                        archived_at: "2026-01-01T00:00:00Z",
                        id: "archived",
                        pr_number: 42,
                    }),
                ],
                42
            )
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

describe("isAlreadySynced", () => {
    it("is true when status is last column and pr is merged", () => {
        expect(
            isAlreadySynced(
                task({ id: "x", pr_state: "merged", status: "done" }),
                "done"
            )
        ).toBe(true);
        expect(
            isAlreadySynced(
                task({ id: "x", pr_state: "open", status: "done" }),
                "done"
            )
        ).toBe(false);
    });
});
