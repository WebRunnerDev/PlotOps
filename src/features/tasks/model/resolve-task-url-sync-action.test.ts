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
});
