import { describe, expect, it } from "vitest";

import {
    assertParentLinkLegal,
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
