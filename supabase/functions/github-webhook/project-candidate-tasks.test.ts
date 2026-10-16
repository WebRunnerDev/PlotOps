import { describe, expect, it } from "vitest";

import type { CandidateTask } from "./match-task";

import { matchTask } from "./match-task";
import {
    fetchProjectCandidateTasks,
    PROJECT_CANDIDATE_PAGE_SIZE,
    type ProjectCandidateClient,
    type ProjectCandidatePage,
} from "./project-candidate-tasks";

function clientWithPages(pages: CandidateTask[][]): {
    calls: Array<{ from: number; to: number }>;
    client: ProjectCandidateClient;
} {
    const calls: Array<{ from: number; to: number }> = [];
    let index = 0;
    const client: ProjectCandidateClient = {
        from: () => ({
            select: () => ({
                eq: () => ({
                    order: () => ({
                        range: (from, to) => {
                            calls.push({ from, to });
                            const page = pages[index] ?? [];
                            index += 1;
                            const result: ProjectCandidatePage = {
                                data: page,
                                error: null,
                            };
                            return Promise.resolve(result);
                        },
                    }),
                }),
            }),
        }),
    };
    return { calls, client };
}

function task(
    partial: Partial<CandidateTask> & Pick<CandidateTask, "id">
): CandidateTask {
    return {
        archived_at: null,
        board_id: "board-1",
        branch_name: "feature/TASK-9-login",
        pr_number: null,
        pr_state: null,
        status: "todo",
        task_key: "TASK-1",
        ...partial,
    };
}

describe("fetchProjectCandidateTasks", () => {
    it("keeps paging past the PostgREST cap so pr_number wins over a shared branch", async () => {
        const impostor = task({
            id: "task-impostor",
            pr_number: null,
            task_key: "TASK-2",
        });
        const fillers = Array.from(
            { length: PROJECT_CANDIDATE_PAGE_SIZE - 1 },
            (_, index) =>
                task({
                    branch_name: `other/branch-${index}`,
                    id: `filler-${index}`,
                    task_key: `TASK-${index + 10}`,
                })
        );
        const linked = task({
            id: "task-linked",
            pr_number: 42,
            pr_state: "open",
            task_key: "TASK-9",
        });
        const { calls, client } = clientWithPages([
            [impostor, ...fillers],
            [linked],
        ]);

        const rows = await fetchProjectCandidateTasks(client, "project-1");

        expect(calls).toEqual([
            { from: 0, to: PROJECT_CANDIDATE_PAGE_SIZE - 1 },
            {
                from: PROJECT_CANDIDATE_PAGE_SIZE,
                to: PROJECT_CANDIDATE_PAGE_SIZE * 2 - 1,
            },
        ]);
        expect(
            matchTask(rows, {
                headRef: "feature/TASK-9-login",
                prNumber: 42,
            })?.id
        ).toBe("task-linked");
        expect(
            matchTask([impostor, ...fillers], {
                headRef: "feature/TASK-9-login",
                prNumber: 42,
            })?.id
        ).toBe("task-impostor");
    });

    it("stops when a page is short", async () => {
        const { calls, client } = clientWithPages([[task({ id: "only" })]]);

        const rows = await fetchProjectCandidateTasks(client, "project-1");

        expect(rows.map((row) => row.id)).toEqual(["only"]);
        expect(calls).toHaveLength(1);
    });

    it("throws when a page fails", async () => {
        const client: ProjectCandidateClient = {
            from: () => ({
                select: () => ({
                    eq: () => ({
                        order: () => ({
                            range: () =>
                                Promise.resolve({
                                    data: null,
                                    error: { message: "db down" },
                                }),
                        }),
                    }),
                }),
            }),
        };

        await expect(
            fetchProjectCandidateTasks(client, "project-1")
        ).rejects.toEqual({ message: "db down" });
    });
});
