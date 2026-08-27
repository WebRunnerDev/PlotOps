import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import type { BoardTasksCache } from "@/features/tasks/api/tasks-api";
import type { Task } from "@/features/tasks/model/types";

import { taskKeys } from "@/features/tasks/model/query-keys";

import { resolveCachedTaskBoardId } from "./resolve-cached-task-board-id";

function task(id: string, boardId: string): Task {
    return {
        boardId,
        createdAt: "2026-08-17T00:00:00.000Z",
        id,
        key: id.toUpperCase(),
        status: "todo",
        title: id,
        type: "task",
    };
}

describe("resolveCachedTaskBoardId", () => {
    it("reads Board id from the Project task list", () => {
        const queryClient = new QueryClient();
        queryClient.setQueryData<Task[]>(taskKeys.project("project", false), [
            task("a", "board-a"),
            task("b", "board-b"),
        ]);

        expect(resolveCachedTaskBoardId(queryClient, "project", "b")).toBe(
            "board-b"
        );
    });

    it("falls back to a Board cache when the Project list is empty", () => {
        const queryClient = new QueryClient();
        queryClient.setQueryData<BoardTasksCache>(
            taskKeys.board("project", "board-b"),
            {
                taskPositions: new Map(),
                tasks: [task("b", "board-b")],
            }
        );

        expect(resolveCachedTaskBoardId(queryClient, "project", "b")).toBe(
            "board-b"
        );
    });

    it("returns undefined when the Task is not cached", () => {
        const queryClient = new QueryClient();
        expect(
            resolveCachedTaskBoardId(queryClient, "project", "missing")
        ).toBeUndefined();
    });
});
