import { describe, expect, it } from "vitest";

import type { Sprint } from "./types";

import { buildSprintHistoryRows } from "./build-sprint-history-rows";

function sprint(overrides: Partial<Sprint> & Pick<Sprint, "id">): Sprint {
    return {
        boardId: "b",
        committedTaskIds: [],
        completedTaskIds: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        name: overrides.id,
        projectId: "p",
        state: "closed",
        ...overrides,
    };
}

describe("buildSprintHistoryRows", () => {
    it("lists Closed and Canceled sprints newest first in points", () => {
        const { metric, rows } = buildSprintHistoryRows({
            sprints: [
                sprint({
                    closedAt: "2026-03-01T00:00:00.000Z",
                    committedTaskIds: ["a", "b"],
                    completedTaskIds: ["a"],
                    id: "s1",
                }),
                sprint({
                    canceledAt: "2026-04-01T00:00:00.000Z",
                    committedTaskIds: ["c"],
                    id: "s2",
                    state: "canceled",
                }),
                sprint({ id: "s3", state: "active" }),
                sprint({ id: "s4", state: "draft" }),
            ],
            tasks: [
                { estimate: 5, id: "a" },
                { estimate: 3, id: "b" },
                { id: "c" },
            ],
        });

        expect(metric).toBe("points");
        expect(rows.map((row) => row.sprint.id)).toEqual(["s2", "s1"]);
        expect(rows[0]).toMatchObject({
            committed: 0,
            completed: null,
            completion: null,
        });
        expect(rows[1]).toMatchObject({
            committed: 8,
            completed: 5,
            completion: 5 / 8,
        });
    });

    it("counts Tasks when nothing is estimated", () => {
        const { metric, rows } = buildSprintHistoryRows({
            sprints: [
                sprint({
                    closedAt: "2026-03-01T00:00:00.000Z",
                    committedTaskIds: ["a", "b"],
                    completedTaskIds: ["a", "b"],
                    id: "s1",
                }),
            ],
            tasks: [],
        });

        expect(metric).toBe("count");
        expect(rows[0]).toMatchObject({
            committed: 2,
            completed: 2,
            completion: 1,
        });
    });
});
