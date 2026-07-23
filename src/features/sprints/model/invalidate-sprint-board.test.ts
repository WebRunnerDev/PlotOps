import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { taskKeys } from "@/features/tasks";

import { invalidateSprintBoardCaches } from "./invalidate-sprint-board";
import { sprintKeys } from "./query-keys";

const projectId = "proj_1";
const boardId = "board_1";

describe("sprint membership → tasks-for-board invalidation seam", () => {
    it("marks the Board Tasks query stale without a shared ProjectBoard bag", () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });

        const tasksKey = taskKeys.board(projectId, boardId);
        const sprintsKey = sprintKeys.board(boardId);

        queryClient.setQueryData(tasksKey, {
            taskPositions: new Map(),
            tasks: [],
        });
        queryClient.setQueryData(sprintsKey, []);

        invalidateSprintBoardCaches(queryClient, projectId, boardId);

        expect(queryClient.getQueryState(tasksKey)?.isInvalidated).toBe(true);
        expect(queryClient.getQueryState(sprintsKey)?.isInvalidated).toBe(true);
    });
});
