import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    clearCreateTaskDraft,
    createTaskDraftKey,
    getCreateTaskDraft,
    setCreateTaskDraft,
} from "./task-drafts";

function memorySessionStorage() {
    const map = new Map<string, string>();
    return {
        getItem: (key: string) => map.get(key) ?? null,
        removeItem: (key: string) => {
            map.delete(key);
        },
        setItem: (key: string, value: string) => {
            map.set(key, value);
        },
    };
}

describe("task drafts", () => {
    beforeEach(() => {
        vi.stubGlobal("sessionStorage", memorySessionStorage());
    });

    it("persists and restores a create draft per board column", () => {
        setCreateTaskDraft("board-a", "todo", "  Login page  ");
        expect(getCreateTaskDraft("board-a", "todo")).toEqual({
            title: "Login page",
            updatedAt: expect.any(Number),
            v: 1,
        });
        expect(getCreateTaskDraft("board-a", "doing")).toBeNull();
        expect(createTaskDraftKey("board-a", "todo")).toBe(
            "plotops:task-draft:create:board-a:todo"
        );
    });

    it("clears create draft when title is empty or cleared", () => {
        setCreateTaskDraft("board-a", "todo", "Draft");
        setCreateTaskDraft("board-a", "todo", "   ");
        expect(getCreateTaskDraft("board-a", "todo")).toBeNull();

        setCreateTaskDraft("board-a", "todo", "Again");
        clearCreateTaskDraft("board-a", "todo");
        expect(getCreateTaskDraft("board-a", "todo")).toBeNull();
    });

    it("ignores corrupt sessionStorage payloads", () => {
        sessionStorage.setItem(
            createTaskDraftKey("board-a", "todo"),
            "{not-json"
        );
        expect(getCreateTaskDraft("board-a", "todo")).toBeNull();
    });
});
