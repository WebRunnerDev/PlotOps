import { describe, expect, it } from "vitest";

import type { CandidateTask } from "../github-webhook/match-task";

import { planBackfill } from "./plan-backfill";

function task(
    partial: Partial<CandidateTask> & Pick<CandidateTask, "id" | "task_key">
): CandidateTask {
    return {
        archived_at: null,
        board_id: "board-1",
        branch_name: null,
        pr_number: null,
        pr_state: null,
        status: "todo",
        ...partial,
    };
}

const pr = (number: number, head: string, title = "", body = null) => ({
    body,
    headRef: head,
    htmlUrl: null,
    number,
    title,
});

describe("planBackfill", () => {
    const tasks = [
        task({ id: "t1", task_key: "TASK-1" }),
        task({
            branch_name: "wip",
            id: "t2",
            pr_number: 5,
            task_key: "TASK-2",
        }),
    ];

    it("keeps open PRs that name a Task or are already linked", () => {
        const plan = planBackfill(tasks, {
            branches: [],
            pulls: [
                pr(1, "fix-login", "TASK-1: Fix login"),
                pr(5, "wip"),
                pr(9, "chore/deps", "Bump vite-5"),
            ],
        });

        expect(plan.pulls.map((item) => item.number)).toEqual([1, 5]);
    });

    it("keeps branches with a task key that no open PR heads", () => {
        const plan = planBackfill(tasks, {
            branches: [
                { name: "main" },
                { name: "TASK-1-login" },
                { name: "feature/TASK-1-api" },
                { name: "TASK-77-unknown" },
            ],
            pulls: [pr(3, "feature/TASK-1-api")],
        });

        expect(plan.branches).toEqual(["TASK-1-login"]);
    });
});
