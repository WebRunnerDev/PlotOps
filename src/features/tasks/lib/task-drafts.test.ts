import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    clearCreateBacklogTaskDraft,
    clearCreateTaskDraft,
    createBacklogTaskDraftKey,
    createTaskDraftKey,
    getCreateBacklogTaskDraft,
    getCreateTaskDraft,
    setCreateBacklogTaskDraft,
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
            v: 2,
        });
        expect(getCreateTaskDraft("board-a", "doing")).toBeNull();
        expect(createTaskDraftKey("board-a", "todo")).toBe(
            "plotops:task-draft:create:board-a:todo"
        );
    });

    it("persists quick-add metadata with the title (v2)", () => {
        setCreateTaskDraft("board-a", "todo", "Login page", {
            assigneeId: "user-1",
            labelIds: ["label-a", "label-b"],
            priority: "high",
            type: "bug",
        });
        expect(getCreateTaskDraft("board-a", "todo")).toEqual({
            assigneeId: "user-1",
            labelIds: ["label-a", "label-b"],
            priority: "high",
            title: "Login page",
            type: "bug",
            updatedAt: expect.any(Number),
            v: 2,
        });
    });

    it("persists explicit None / Unassigned / empty labels in the draft", () => {
        setCreateTaskDraft("board-a", "todo", "No meta", {
            assigneeId: null,
            labelIds: [],
            priority: null,
            type: "feature",
        });
        expect(getCreateTaskDraft("board-a", "todo")).toEqual({
            assigneeId: null,
            labelIds: [],
            priority: null,
            title: "No meta",
            type: "feature",
            updatedAt: expect.any(Number),
            v: 2,
        });
    });

    it("still reads legacy v1 title-only drafts", () => {
        sessionStorage.setItem(
            createTaskDraftKey("board-a", "todo"),
            JSON.stringify({
                title: "Legacy draft",
                updatedAt: 1,
                v: 1,
            })
        );
        expect(getCreateTaskDraft("board-a", "todo")).toEqual({
            title: "Legacy draft",
            updatedAt: 1,
            v: 1,
        });
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

    it("scopes backlog create drafts per board section (backlog vs sprint)", () => {
        setCreateBacklogTaskDraft("board-a", null, "  Backlog item  ", {
            priority: "urgent",
            type: "task",
        });
        setCreateBacklogTaskDraft("board-a", "sprint-1", "Sprint item");

        expect(getCreateBacklogTaskDraft("board-a", null)).toEqual({
            priority: "urgent",
            title: "Backlog item",
            type: "task",
            updatedAt: expect.any(Number),
            v: 2,
        });
        expect(getCreateBacklogTaskDraft("board-a", "sprint-1")).toEqual({
            title: "Sprint item",
            updatedAt: expect.any(Number),
            v: 2,
        });
        expect(getCreateBacklogTaskDraft("board-a", "sprint-2")).toBeNull();
        expect(createBacklogTaskDraftKey("board-a", null)).toBe(
            "plotops:task-draft:create-backlog:board-a:none"
        );

        clearCreateBacklogTaskDraft("board-a", null);
        expect(getCreateBacklogTaskDraft("board-a", null)).toBeNull();
        expect(getCreateBacklogTaskDraft("board-a", "sprint-1")).not.toBeNull();
    });
});
