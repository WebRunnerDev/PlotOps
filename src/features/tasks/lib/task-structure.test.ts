import { describe, expect, it } from "vitest";

import {
    assertParentLinkLegal,
    parentArchiveRefusal,
    parentDeleteRefusal,
    parentDoneRefusal,
    type ParentGateTask,
    parentLinkRefusal,
    subtasksOf,
    type TaskStructureNode,
} from "./task-structure";

function node(
    id: string,
    overrides: Partial<TaskStructureNode> = {}
): TaskStructureNode {
    return {
        id,
        projectId: "proj-a",
        ...overrides,
    };
}

describe("parentLinkRefusal — one-level same-Project hierarchy", () => {
    const root = node("root");
    const otherRoot = node("other-root");
    const child = node("child", { parentId: "root" });
    const otherProject = node("foreign", { projectId: "proj-b" });

    const tasks = [root, otherRoot, child, otherProject];

    it("allows attaching a root Task as a Subtask of another root in the same Project", () => {
        expect(parentLinkRefusal(otherRoot, root, tasks)).toBeNull();
    });

    it("allows creating a new Subtask under a root Task", () => {
        expect(
            parentLinkRefusal({ projectId: "proj-a" }, root, tasks)
        ).toBeNull();
    });

    it("refuses a Task parenting itself", () => {
        expect(parentLinkRefusal(root, root, tasks)).toBe("self");
    });

    it("refuses a Parent and Subtask in different Projects", () => {
        expect(parentLinkRefusal(otherProject, root, tasks)).toBe(
            "different_project"
        );
        expect(parentLinkRefusal({ projectId: "proj-b" }, root, tasks)).toBe(
            "different_project"
        );
    });

    it("refuses making a Subtask into a Parent Task", () => {
        expect(parentLinkRefusal(otherRoot, child, tasks)).toBe(
            "parent_is_subtask"
        );
        expect(parentLinkRefusal({ projectId: "proj-a" }, child, tasks)).toBe(
            "parent_is_subtask"
        );
    });

    it("refuses attaching a Parent Task as a Subtask of something else", () => {
        expect(parentLinkRefusal(root, otherRoot, tasks)).toBe(
            "child_is_parent"
        );
    });

    it("refuses when the Parent Task is missing", () => {
        expect(parentLinkRefusal(otherRoot, undefined, tasks)).toBe(
            "parent_missing"
        );
    });

    it("throws the Product refusal when asserting an illegal Parent link", () => {
        expect(() => assertParentLinkLegal(otherRoot, child, tasks)).toThrow(
            "A Subtask cannot have Subtasks"
        );
        expect(() => assertParentLinkLegal(root, otherRoot, tasks)).toThrow(
            "A Parent Task cannot become a Subtask"
        );
    });
});

describe("subtasksOf", () => {
    it("returns Tasks whose parentId matches, in list order", () => {
        const parent = node("parent");
        const first = node("a", { parentId: "parent" });
        const second = node("b", { parentId: "parent" });
        const unrelated = node("c", { parentId: "other" });

        expect(
            subtasksOf("parent", [parent, first, unrelated, second])
        ).toEqual([first, second]);
    });
});

function gate(
    id: string,
    overrides: Partial<ParentGateTask> = {}
): ParentGateTask {
    return {
        id,
        isDone: false,
        ...overrides,
    };
}

describe("parentDoneRefusal — Parent Task cannot enter Done while a Subtask is open", () => {
    it("allows a Task with no Subtasks", () => {
        const parent = gate("parent");
        expect(parentDoneRefusal("parent", [parent])).toBeNull();
    });

    it("allows a Parent Task when every active Subtask is Done", () => {
        const parent = gate("parent");
        const child = gate("child", { isDone: true, parentId: "parent" });
        expect(parentDoneRefusal("parent", [parent, child])).toBeNull();
    });

    it("refuses a Parent Task while any active Subtask is not Done", () => {
        const parent = gate("parent");
        const open = gate("open", { parentId: "parent" });
        const done = gate("done", { isDone: true, parentId: "parent" });
        expect(parentDoneRefusal("parent", [parent, open, done])).toBe(
            "incomplete_subtasks"
        );
    });

    it("ignores archived Subtasks when deciding Done", () => {
        const parent = gate("parent");
        const archivedOpen = gate("archived", {
            archivedAt: "2026-08-01T00:00:00.000Z",
            parentId: "parent",
        });
        const done = gate("done", { isDone: true, parentId: "parent" });
        expect(
            parentDoneRefusal("parent", [parent, archivedOpen, done])
        ).toBeNull();
    });
});

describe("parentArchiveRefusal — Parent Task cannot be archived while a Subtask is active", () => {
    it("allows archive when the Task has no Subtasks", () => {
        expect(parentArchiveRefusal("solo", [gate("solo")])).toBeNull();
    });

    it("allows archive when every Subtask is already archived", () => {
        const parent = gate("parent");
        const child = gate("child", {
            archivedAt: "2026-08-01T00:00:00.000Z",
            parentId: "parent",
        });
        expect(parentArchiveRefusal("parent", [parent, child])).toBeNull();
    });

    it("refuses archive while any Subtask is still active", () => {
        const parent = gate("parent");
        const active = gate("active", { isDone: true, parentId: "parent" });
        const archived = gate("archived", {
            archivedAt: "2026-08-01T00:00:00.000Z",
            parentId: "parent",
        });
        expect(parentArchiveRefusal("parent", [parent, active, archived])).toBe(
            "active_subtasks"
        );
    });
});

describe("parentDeleteRefusal — Parent Task cannot be deleted while a Subtask exists", () => {
    it("allows delete when the Task has no Subtasks", () => {
        expect(parentDeleteRefusal("solo", [gate("solo")])).toBeNull();
    });

    it("refuses delete while an archived Subtask still exists", () => {
        const parent = gate("parent");
        const child = gate("child", {
            archivedAt: "2026-08-01T00:00:00.000Z",
            isDone: true,
            parentId: "parent",
        });
        expect(parentDeleteRefusal("parent", [parent, child])).toBe(
            "subtasks_exist"
        );
    });

    it("refuses delete while an active Subtask exists", () => {
        const parent = gate("parent");
        const child = gate("child", { parentId: "parent" });
        expect(parentDeleteRefusal("parent", [parent, child])).toBe(
            "subtasks_exist"
        );
    });
});
