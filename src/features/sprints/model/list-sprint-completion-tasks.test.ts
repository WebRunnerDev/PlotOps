import { describe, expect, it } from "vitest";

import { listSprintCompletionTasks } from "./list-sprint-completion-tasks";

describe("listSprintCompletionTasks", () => {
    it("marks live Closed members and labels reassigned snapshot rows", () => {
        const rows = listSprintCompletionTasks({
            completedTaskIds: ["a", "b", "gone"],
            sprintId: "closed-1",
            tasks: [
                {
                    id: "a",
                    key: "T-1",
                    sprintId: "closed-1",
                    title: "Done A",
                },
                {
                    id: "b",
                    key: "T-2",
                    sprintId: undefined,
                    title: "Moved later",
                },
            ],
        });

        expect(rows).toEqual([
            {
                id: "a",
                key: "T-1",
                stillMember: true,
                title: "Done A",
            },
            {
                id: "b",
                key: "T-2",
                stillMember: false,
                title: "Moved later",
            },
            {
                id: "gone",
                key: undefined,
                stillMember: false,
                title: undefined,
            },
        ]);
    });
});
