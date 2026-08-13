import { describe, expect, it } from "vitest";

import { cloneGuestDemoSeed, GUEST_DEMO_SEED } from "./guest-demo-seed";

describe("GUEST_DEMO_SEED name-only project", () => {
    it("includes a project without GitHub fields and a board that spans every column", () => {
        const nameOnly = GUEST_DEMO_SEED.projects.find(
            (project) => project.githubRepoId == undefined
        );

        expect(nameOnly).toBeDefined();
        expect(nameOnly!.githubFullName).toBeNull();
        expect(nameOnly!.githubHtmlUrl).toBeNull();
        expect(nameOnly!.githubDefaultBranch).toBeNull();

        const board = GUEST_DEMO_SEED.boards.find(
            (item) => item.projectId === nameOnly!.id
        );
        expect(board).toBeDefined();

        const boardTasks = GUEST_DEMO_SEED.tasks.filter(
            (task) =>
                task.projectId === nameOnly!.id && task.boardId === board!.id
        );

        const columnIds = new Set(board!.columns.map((column) => column.id));
        const statuses = new Set(boardTasks.map((task) => task.status));

        expect(columnIds.size).toBeGreaterThan(0);
        for (const columnId of columnIds) {
            expect(statuses.has(columnId)).toBe(true);
        }

        expect(
            boardTasks.every(
                (task) => task.branchName == undefined && task.pr == undefined
            )
        ).toBe(true);

        expect(boardTasks.some((task) => task.sprintId == undefined)).toBe(
            true
        );
    });

    it("cloneGuestDemoSeed keeps the name-only project independent of mutation", () => {
        const clone = cloneGuestDemoSeed();
        const nameOnly = clone.projects.find(
            (project) => project.githubRepoId == undefined
        );
        expect(nameOnly).toBeDefined();

        nameOnly!.name = "Mutated";
        const canonical = GUEST_DEMO_SEED.projects.find(
            (project) => project.githubRepoId == undefined
        );
        expect(canonical!.name).not.toBe("Mutated");
    });

    it("seeds a Parent Task with Subtasks on the Git demo Board", () => {
        const children = GUEST_DEMO_SEED.tasks.filter((task) => task.parentId);
        expect(children.length).toBeGreaterThanOrEqual(2);

        const parentIds = new Set(children.map((task) => task.parentId));
        expect(parentIds.size).toBeGreaterThanOrEqual(1);

        for (const parentId of parentIds) {
            const parent = GUEST_DEMO_SEED.tasks.find(
                (task) => task.id === parentId
            );
            expect(parent).toBeDefined();
            expect(parent!.parentId).toBeUndefined();
            expect(parent!.projectId).toBe(children[0]!.projectId);
        }

        const statuses = new Set(children.map((task) => task.status));
        expect(statuses.has("done")).toBe(true);
        expect(statuses.has("todo") || statuses.has("in_progress")).toBe(true);
    });
});
