import { describe, expect, it } from "vitest";

import type { Task } from "@/features/tasks/model/types";

import {
    collectTaskLinkCandidates,
    mergeTaskCatalogs,
} from "./collect-task-link-candidates";

function task(id: string, patch: Partial<Task> & Pick<Task, "boardId">): Task {
    return {
        createdAt: "2026-08-17T00:00:00.000Z",
        id,
        key: patch.key ?? id.toUpperCase(),
        status: "todo",
        title: id,
        type: "task",
        ...patch,
    };
}

describe("collectTaskLinkCandidates", () => {
    it("includes Tasks from other Boards in the same Project", () => {
        const current = task("a", { boardId: "board-a", key: "TASK-1" });
        const other = task("b", { boardId: "board-b", key: "TASK-2" });

        const candidates = collectTaskLinkCandidates({
            addKind: "blocked_by",
            peers: [],
            projectId: "project",
            taskId: current.id,
            tasks: mergeTaskCatalogs([[current], [other]]),
        });

        expect(candidates.map((item) => item.id)).toEqual(["b"]);
    });

    it("still allows blocks to a Task on another Board", () => {
        const current = task("a", { boardId: "board-a", key: "TASK-1" });
        const other = task("b", { boardId: "board-b", key: "TASK-2" });

        const candidates = collectTaskLinkCandidates({
            addKind: "blocks",
            peers: [],
            projectId: "project",
            taskId: current.id,
            tasks: [current, other],
        });

        expect(candidates.map((item) => item.id)).toEqual(["b"]);
    });
});
