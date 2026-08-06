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
        id: "task-1",
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
});
