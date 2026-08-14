import { describe, expect, it } from "vitest";

import {
    assertParentLinkLegal,
    assertTaskLinkLegal,
    hasOpenBlocker,
    parentArchiveRefusal,
    parentDeleteRefusal,
    parentDoneRefusal,
    type ParentGateTask,
    parentLinkRefusal,
    subtasksOf,
    taskDoneRefusal,
    type TaskLinkEdge,
    taskLinkRefusal,
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

describe("taskLinkRefusal — relates to is Project-scoped and not hierarchy", () => {
    const rootA = node("root-a");
    const rootB = node("root-b");
    const child = node("child", { parentId: "root-a" });
    const otherBoard = node("other-board");
    const otherProject = node("foreign", { projectId: "proj-b" });
    const tasks = [rootA, rootB, child, otherBoard, otherProject];

    it("allows relates to between two Tasks in the same Project", () => {
        expect(
            taskLinkRefusal("root-a", "root-b", "relates_to", tasks, [])
        ).toBeNull();
    });

    it("allows relates to across Boards in the same Project", () => {
        expect(
            taskLinkRefusal("root-a", "other-board", "relates_to", tasks, [])
        ).toBeNull();
    });

    it("refuses a Task linking to itself", () => {
        expect(
            taskLinkRefusal("root-a", "root-a", "relates_to", tasks, [])
        ).toBe("self");
    });

    it("refuses a Task Link between a Parent Task and its Subtask", () => {
        expect(
            taskLinkRefusal("root-a", "child", "relates_to", tasks, [])
        ).toBe("parent_subtask");
        expect(
            taskLinkRefusal("child", "root-a", "relates_to", tasks, [])
        ).toBe("parent_subtask");
    });

    it("refuses a Task Link across Projects", () => {
        expect(
            taskLinkRefusal("root-a", "foreign", "relates_to", tasks, [])
        ).toBe("different_project");
    });

    it("refuses when either Task is missing", () => {
        expect(
            taskLinkRefusal("root-a", "missing", "relates_to", tasks, [])
        ).toBe("task_missing");
        expect(
            taskLinkRefusal("missing", "root-b", "relates_to", tasks, [])
        ).toBe("task_missing");
    });

    it("refuses a duplicate relates to pair in either direction", () => {
        const existing = [
            {
                kind: "relates_to" as const,
                sourceId: "root-a",
                targetId: "root-b",
            },
        ];
        expect(
            taskLinkRefusal("root-a", "root-b", "relates_to", tasks, existing)
        ).toBe("duplicate");
        expect(
            taskLinkRefusal("root-b", "root-a", "relates_to", tasks, existing)
        ).toBe("duplicate");
    });

    it("throws the Product refusal when asserting an illegal Task Link", () => {
        expect(() =>
            assertTaskLinkLegal("root-a", "root-a", "relates_to", tasks, [])
        ).toThrow("A Task cannot relate to itself");
        expect(() =>
            assertTaskLinkLegal("root-a", "child", "relates_to", tasks, [])
        ).toThrow(
            "A Task Link cannot connect a Parent Task and its own Subtask"
        );
    });
});

describe("taskLinkRefusal — blocks is directed and acyclic", () => {
    const rootA = node("root-a");
    const rootB = node("root-b");
    const rootC = node("root-c");
    const child = node("child", { parentId: "root-a" });
    const tasks = [rootA, rootB, rootC, child];

    it("allows a blocks link between two Tasks in the same Project", () => {
        expect(
            taskLinkRefusal("root-a", "root-b", "blocks", tasks, [])
        ).toBeNull();
    });

    it("refuses a Task blocking itself", () => {
        expect(taskLinkRefusal("root-a", "root-a", "blocks", tasks, [])).toBe(
            "self"
        );
    });

    it("refuses a blocks link between a Parent Task and its Subtask", () => {
        expect(taskLinkRefusal("root-a", "child", "blocks", tasks, [])).toBe(
            "parent_subtask"
        );
    });

    it("refuses a duplicate directed blocks pair", () => {
        const existing: TaskLinkEdge[] = [
            { kind: "blocks", sourceId: "root-a", targetId: "root-b" },
        ];
        expect(
            taskLinkRefusal("root-a", "root-b", "blocks", tasks, existing)
        ).toBe("duplicate");
    });

    it("allows relates to and blocks between the same pair", () => {
        const existing: TaskLinkEdge[] = [
            { kind: "relates_to", sourceId: "root-a", targetId: "root-b" },
        ];
        expect(
            taskLinkRefusal("root-a", "root-b", "blocks", tasks, existing)
        ).toBeNull();
    });

    it("refuses a two-Task cyclic blocks chain", () => {
        const existing: TaskLinkEdge[] = [
            { kind: "blocks", sourceId: "root-a", targetId: "root-b" },
        ];
        expect(
            taskLinkRefusal("root-b", "root-a", "blocks", tasks, existing)
        ).toBe("blocks_cycle");
    });

    it("refuses a longer cyclic blocks chain", () => {
        const existing: TaskLinkEdge[] = [
            { kind: "blocks", sourceId: "root-a", targetId: "root-b" },
            { kind: "blocks", sourceId: "root-b", targetId: "root-c" },
        ];
        expect(
            taskLinkRefusal("root-c", "root-a", "blocks", tasks, existing)
        ).toBe("blocks_cycle");
    });

    it("throws the Product refusal when asserting a cyclic blocks chain", () => {
        const existing: TaskLinkEdge[] = [
            { kind: "blocks", sourceId: "root-a", targetId: "root-b" },
        ];
        expect(() =>
            assertTaskLinkLegal("root-b", "root-a", "blocks", tasks, existing)
        ).toThrow("A cyclic blocks chain is not allowed");
    });
});

describe("taskDoneRefusal — open blockers compose with incomplete Subtasks", () => {
    it("allows Done when the Task has no open blocker", () => {
        expect(taskDoneRefusal("solo", [gate("solo")], [])).toBeNull();
    });

    it("allows Done when the blocker is already Done", () => {
        const blocked = gate("blocked");
        const blocker = gate("blocker", { isDone: true });
        const links: TaskLinkEdge[] = [
            { kind: "blocks", sourceId: "blocker", targetId: "blocked" },
        ];
        expect(
            taskDoneRefusal("blocked", [blocked, blocker], links)
        ).toBeNull();
    });

    it("allows Done when the blocker is archived", () => {
        const blocked = gate("blocked");
        const blocker = gate("blocker", {
            archivedAt: "2026-08-01T00:00:00.000Z",
        });
        const links: TaskLinkEdge[] = [
            { kind: "blocks", sourceId: "blocker", targetId: "blocked" },
        ];
        expect(
            taskDoneRefusal("blocked", [blocked, blocker], links)
        ).toBeNull();
    });

    it("refuses Done while an open blocker exists", () => {
        const blocked = gate("blocked");
        const blocker = gate("blocker");
        const links: TaskLinkEdge[] = [
            { kind: "blocks", sourceId: "blocker", targetId: "blocked" },
        ];
        expect(taskDoneRefusal("blocked", [blocked, blocker], links)).toBe(
            "open_blocker"
        );
    });

    it("allows a blocked Task to stay out of Done (in-progress is not gated)", () => {
        const blocked = gate("blocked");
        const blocker = gate("blocker");
        const links: TaskLinkEdge[] = [
            { kind: "blocks", sourceId: "blocker", targetId: "blocked" },
        ];
        expect(hasOpenBlocker("blocked", [blocked, blocker], links)).toBe(true);
        expect(
            taskDoneRefusal("blocker", [blocked, blocker], links)
        ).toBeNull();
    });

    it("refuses a Parent Task with incomplete Subtasks even without blockers", () => {
        const parent = gate("parent");
        const child = gate("child", { parentId: "parent" });
        expect(taskDoneRefusal("parent", [parent, child], [])).toBe(
            "incomplete_subtasks"
        );
    });

    it("composes Parent incomplete-Subtask and open-blocker gates", () => {
        const parent = gate("parent");
        const child = gate("child", { parentId: "parent" });
        const blocker = gate("blocker");
        const links: TaskLinkEdge[] = [
            { kind: "blocks", sourceId: "blocker", targetId: "parent" },
        ];
        const reason = taskDoneRefusal(
            "parent",
            [parent, child, blocker],
            links
        );
        expect(
            reason === "incomplete_subtasks" || reason === "open_blocker"
        ).toBe(true);
    });
});
