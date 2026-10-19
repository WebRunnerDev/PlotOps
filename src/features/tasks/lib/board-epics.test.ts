import { describe, expect, it } from "vitest";

import type { ProjectEpic, Task } from "@/features/tasks/model/types";

import { resolveCardEpic, withoutEpics } from "./board-epics";
import {
    EMPTY_BOARD_FILTERS,
    filterTasks,
    isBoardFiltersActive,
    NO_EPIC_FILTER,
} from "./filter-tasks";

function task(id: string, overrides: Partial<Task> = {}): Task {
    return {
        boardId: "board",
        createdAt: "2026-01-01T00:00:00.000Z",
        id,
        key: id,
        status: "todo",
        title: id,
        type: "task",
        ...overrides,
    };
}

const epic: ProjectEpic = {
    boardId: "board",
    color: "green",
    doneCount: 0,
    id: "e1",
    isDone: false,
    key: "EPIC-1",
    pointsDone: 0,
    pointsTotal: 0,
    status: "todo",
    taskCount: 1,
    title: "Checkout",
    unestimatedCount: 1,
};

describe("withoutEpics", () => {
    it("drops Epic cards from Board / Backlog lists", () => {
        const tasks = [task("a"), task("e1", { type: "epic" }), task("b")];
        expect(withoutEpics(tasks).map((item) => item.id)).toEqual(["a", "b"]);
    });
});

describe("resolveCardEpic", () => {
    const epicsById = new Map([[epic.id, epic]]);

    it("uses the Task's own Epic, or the Parent's for Subtasks", () => {
        expect(resolveCardEpic({ epicId: "e1" }, epicsById)).toEqual({
            color: "green",
            key: "EPIC-1",
            title: "Checkout",
        });
        expect(resolveCardEpic({ parentEpicId: "e1" }, epicsById)?.key).toBe(
            "EPIC-1"
        );
        expect(resolveCardEpic({}, epicsById)).toBeUndefined();
        expect(resolveCardEpic({ epicId: "gone" }, epicsById)).toBeUndefined();
    });
});

describe("filterTasks epics", () => {
    const tasks = [
        task("in", { epicId: "e1" }),
        task("child", { parentEpicId: "e1", parentId: "in" }),
        task("loose"),
    ];

    it("stays inactive for filters saved before epicIds existed", () => {
        const legacy = { ...EMPTY_BOARD_FILTERS };
        delete legacy.epicIds;
        expect(isBoardFiltersActive(legacy)).toBe(false);
        expect(filterTasks(tasks, legacy)).toEqual(tasks);
    });

    it("matches Subtasks through their Parent's Epic", () => {
        const result = filterTasks(tasks, {
            ...EMPTY_BOARD_FILTERS,
            epicIds: ["e1"],
        });
        expect(result.map((item) => item.id)).toEqual(["in", "child"]);
    });

    it("supports a No epic facet", () => {
        const result = filterTasks(tasks, {
            ...EMPTY_BOARD_FILTERS,
            epicIds: [NO_EPIC_FILTER],
        });
        expect(result.map((item) => item.id)).toEqual(["loose"]);
    });
});
