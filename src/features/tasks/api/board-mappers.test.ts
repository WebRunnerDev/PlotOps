import { describe, expect, it } from "vitest";

import type { DatabaseTask } from "./board-mappers";

import { mapDatabaseTask } from "./board-mappers";

function databaseTask(overrides: Partial<DatabaseTask> = {}): DatabaseTask {
    return {
        archived_at: null,
        archived_by: null,
        archived_by_profile: null,
        assignee: null,
        assignee_id: null,
        author: null,
        author_id: null,
        board_id: "board",
        branch_name: null,
        created_at: "2026-07-15T12:00:00.000Z",
        deadline: null,
        description: null,
        estimate: null,
        id: "task-1",
        parent: null,
        parent_id: null,
        position: 0,
        pr_number: null,
        pr_state: null,
        pr_url: null,
        priority: null,
        project_id: "project",
        sprint_id: null,
        sprint_position: null,
        status: "todo",
        task_key: "TASK-1",
        task_labels: null,
        task_type: "task",
        title: "Sample",
        ...overrides,
    };
}

describe("mapDatabaseTask", () => {
    it("maps created_at onto Task createdAt for Board sort", () => {
        const task = mapDatabaseTask(
            databaseTask({ created_at: "2026-08-01T09:30:00.000Z" })
        );

        expect(task.createdAt).toBe("2026-08-01T09:30:00.000Z");
    });

    it("maps Fibonacci estimate and omits null as unestimated", () => {
        expect(mapDatabaseTask(databaseTask({ estimate: 5 })).estimate).toBe(5);
        expect(
            mapDatabaseTask(databaseTask({ estimate: null })).estimate
        ).toBeUndefined();
    });

    it("maps Parent id and key when the Task is a Subtask", () => {
        const task = mapDatabaseTask(
            databaseTask({
                parent: { task_key: "FEAT-1" },
                parent_id: "parent-1",
            })
        );

        expect(task.parentId).toBe("parent-1");
        expect(task.parentKey).toBe("FEAT-1");
        expect(mapDatabaseTask(databaseTask()).parentId).toBeUndefined();
    });
});
