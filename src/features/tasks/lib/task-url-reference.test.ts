import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import type { Task } from "@/features/tasks/model/types";

import { taskKeys } from "@/features/tasks/model/query-keys";

import {
    findTaskByUrlReference,
    isTaskKeyParameter,
    resolveTaskIdFromUrlReference,
    resolveTaskKeyForUrl,
} from "./task-url-reference";

const task = (overrides: Partial<Task> = {}): Task =>
    ({
        boardId: "board-a",
        id: "task-uuid",
        key: "TASK-12",
        title: "Login",
        ...overrides,
    }) as Task;

describe("task-url-reference", () => {
    it("detects task keys vs opaque ids", () => {
        expect(isTaskKeyParameter("TASK-12")).toBe(true);
        expect(isTaskKeyParameter("BUG-5")).toBe(true);
        expect(isTaskKeyParameter("b0000000-0000-4000-8000-000000000103")).toBe(
            false
        );
    });

    it("resolves a task key or uuid from project caches", () => {
        const queryClient = new QueryClient();
        queryClient.setQueryData<Task[]>(taskKeys.project("project-a", false), [
            task(),
        ]);

        expect(
            resolveTaskIdFromUrlReference(queryClient, "project-a", "TASK-12")
        ).toBe("task-uuid");
        expect(
            resolveTaskIdFromUrlReference(
                queryClient,
                "project-a",
                "b0000000-0000-4000-8000-000000000103"
            )
        ).toBeUndefined();
        expect(
            findTaskByUrlReference(queryClient, "project-a", "task-12")?.id
        ).toBe("task-uuid");
        expect(
            resolveTaskKeyForUrl(queryClient, "project-a", "task-uuid")
        ).toBe("TASK-12");
    });
});
