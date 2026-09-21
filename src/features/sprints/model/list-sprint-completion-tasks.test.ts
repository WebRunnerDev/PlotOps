import { describe, expect, it } from "vitest";

import { listSprintCompletionTasks } from "./list-sprint-completion-tasks";

describe("listSprintCompletionTasks", () => {
    it("marks live Closed members and labels reassigned snapshot rows", () => {
        const rows = listSprintCompletionTasks({
            completedTaskIds: ["a", "b", "c", "gone"],
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
                {
                    id: "c",
                    key: "T-3",
                    sprintId: "active-2",
                    title: "Carried on",
                },
            ],
        });

        expect(rows).toEqual([
            {
                id: "a",
                inBacklog: false,
                key: "T-1",
                stillMember: true,
                title: "Done A",
            },
            {
                id: "b",
                inBacklog: true,
                key: "T-2",
                stillMember: false,
                title: "Moved later",
            },
            {
                id: "c",
                inBacklog: false,
                key: "T-3",
                stillMember: false,
                title: "Carried on",
            },
            {
                id: "gone",
                inBacklog: false,
                key: undefined,
                stillMember: false,
                title: undefined,
            },
        ]);
    });
});
