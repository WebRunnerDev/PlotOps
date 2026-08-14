import { describe, expect, it } from "vitest";

import type { DatabaseTask } from "./board-mappers";

import {
    mapDatabaseTask,
    parentIdsMissingFromRows,
    withResolvedParentKeys,
} from "./board-mappers";

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

    it("resolves Parent keys from sibling rows without a PostgREST self-embed", () => {
        const parent = databaseTask({
            id: "parent-1",
            task_key: "FEAT-1",
        });
        const child = databaseTask({
            id: "child-1",
            parent_id: "parent-1",
            task_key: "FEAT-2",
        });
        const otherBoardParent = databaseTask({
            id: "child-2",
            parent_id: "parent-elsewhere",
            task_key: "FEAT-3",
        });

        expect(parentIdsMissingFromRows([parent, child])).toEqual([]);
        expect(parentIdsMissingFromRows([otherBoardParent])).toEqual([
            "parent-elsewhere",
        ]);

        const mapped = withResolvedParentKeys([parent, child]).map(
            mapDatabaseTask
        );
        expect(mapped[1]?.parentKey).toBe("FEAT-1");

        const [mappedOther] = withResolvedParentKeys([otherBoardParent], [
            { id: "parent-elsewhere", task_key: "OPS-9" },
        ]).map(mapDatabaseTask);
        expect(mappedOther.parentKey).toBe("OPS-9");
    });

    it("maps relates to peers from outgoing and incoming Task Links", () => {
        const task = mapDatabaseTask(
            databaseTask({
                incoming_links: [
                    {
                        id: "link-in",
                        kind: "relates_to",
                        source: {
                            id: "task-0",
                            task_key: "FEAT-1",
                            title: "Incoming peer",
                        },
                    },
                ],
                outgoing_links: [
                    {
                        id: "link-out",
                        kind: "relates_to",
                        target: {
                            id: "task-2",
                            task_key: "FEAT-2",
                            title: "Outgoing peer",
                        },
                    },
                ],
            })
        );

        expect(task.relatedTasks).toEqual([
            {
                direction: "outgoing",
                id: "link-out",
                kind: "relates_to",
                otherId: "task-2",
                otherKey: "FEAT-2",
                otherTitle: "Outgoing peer",
            },
            {
                direction: "incoming",
                id: "link-in",
                kind: "relates_to",
                otherId: "task-0",
                otherKey: "FEAT-1",
                otherTitle: "Incoming peer",
            },
        ]);
    });

    it("maps blocks peers and hasOpenBlocker from the row", () => {
        const task = mapDatabaseTask(
            databaseTask({
                incoming_links: [
                    {
                        id: "link-block",
                        kind: "blocks",
                        source: {
                            archived_at: null,
                            id: "task-9",
                            task_key: "TASK-9",
                            title: "Blocker",
                        },
                    },
                ],
            })
        );

        expect(task.hasOpenBlocker).toBe(true);
        expect(task.relatedTasks).toEqual([
            {
                direction: "incoming",
                id: "link-block",
                kind: "blocks",
                otherId: "task-9",
                otherKey: "TASK-9",
                otherTitle: "Blocker",
            },
        ]);
    });
});
