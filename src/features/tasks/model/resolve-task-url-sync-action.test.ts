import { describe, expect, it } from "vitest";

import { resolveTaskUrlSyncAction } from "./resolve-task-url-sync-action";

const base = {
    hadUrlTask: undefined,
    selectedTaskId: undefined,
    selectedTaskKey: undefined,
    urlTaskId: undefined,
    urlTaskRef: undefined,
    wasSelected: false,
};

describe("resolveTaskUrlSyncAction", () => {
    it("opens drawer from shared link on first load", () => {
        expect(
            resolveTaskUrlSyncAction({
                ...base,
                urlTaskId: "task-a",
                urlTaskRef: "TASK-1",
            })
        ).toEqual({ taskId: "task-a", type: "select-from-url" });
    });

    it("waits until a task key resolves in cache", () => {
        expect(
            resolveTaskUrlSyncAction({
                ...base,
                urlTaskRef: "TASK-1",
            })
        ).toEqual({ type: "noop" });
    });

    it("pushes URL when a task is selected without query param", () => {
        expect(
            resolveTaskUrlSyncAction({
                ...base,
                selectedTaskId: "task-a",
                selectedTaskKey: "TASK-1",
                wasSelected: true,
            })
        ).toEqual({ taskRef: "TASK-1", type: "push-url" });
    });

    it("canonicalizes legacy uuid params to task keys", () => {
        expect(
            resolveTaskUrlSyncAction({
                ...base,
                selectedTaskId: "task-a",
                selectedTaskKey: "TASK-1",
                urlTaskId: "task-a",
                urlTaskRef: "task-a",
                wasSelected: true,
            })
        ).toEqual({ taskRef: "TASK-1", type: "push-url" });
    });

    it("strips URL after drawer close", () => {
        expect(
            resolveTaskUrlSyncAction({
                ...base,
                hadUrlTask: "TASK-1",
                urlTaskId: "task-a",
                urlTaskRef: "TASK-1",
                wasSelected: true,
            })
        ).toEqual({ type: "strip-url" });
    });

    it("clears selection when browser back removes task param", () => {
        expect(
            resolveTaskUrlSyncAction({
                ...base,
                hadUrlTask: "TASK-1",
                selectedTaskId: "task-a",
                wasSelected: true,
            })
        ).toEqual({ type: "clear-selection" });
    });

    it("pushes URL when selection switches to another task while query stays on the previous one", () => {
        expect(
            resolveTaskUrlSyncAction({
                ...base,
                hadUrlTask: "TASK-1",
                selectedTaskId: "task-b",
                selectedTaskKey: "TASK-2",
                urlTaskId: "task-a",
                urlTaskRef: "TASK-1",
                wasSelected: true,
            })
        ).toEqual({ taskRef: "TASK-2", type: "push-url" });
    });

    it("follows URL when browser navigates to a different task param", () => {
        expect(
            resolveTaskUrlSyncAction({
                ...base,
                hadUrlTask: "TASK-1",
                selectedTaskId: "task-a",
                selectedTaskKey: "TASK-1",
                urlTaskId: "task-b",
                urlTaskRef: "TASK-2",
                wasSelected: true,
            })
        ).toEqual({ taskId: "task-b", type: "select-from-url" });
    });
});
