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

    it("seeds at least one relates to Task Link in the same Project", () => {
        const links = GUEST_DEMO_SEED.taskLinks.filter(
            (link) => link.kind === "relates_to"
        );
        expect(links.length).toBeGreaterThanOrEqual(1);

        const link = links[0]!;
        const source = GUEST_DEMO_SEED.tasks.find(
            (task) => task.id === link.sourceTaskId
        );
        const target = GUEST_DEMO_SEED.tasks.find(
            (task) => task.id === link.targetTaskId
        );
        expect(source).toBeDefined();
        expect(target).toBeDefined();
        expect(source!.projectId).toBe(target!.projectId);
        expect(source!.id).not.toBe(target!.id);
        expect(source!.parentId).not.toBe(target!.id);
        expect(target!.parentId).not.toBe(source!.id);

        const activityMentionsLink = GUEST_DEMO_SEED.activity.some((event) =>
            event.metadata.changes.some(
                (change) =>
                    change.field === "task_link" &&
                    (change.to as { key?: string; kind?: string }).kind ===
                        "relates_to"
            )
        );
        expect(activityMentionsLink).toBe(true);

        expect(
            GUEST_DEMO_SEED.notifications.every(
                (row) => row.kind !== "task_link"
            )
        ).toBe(true);
    });
});
