import { describe, expect, it } from "vitest";

import {
    type CommandPaletteProject,
    type CommandPaletteRouteContext,
    type CommandPaletteTask,
    createTaskIntent,
    matchCommandPaletteTasks,
    resolveCommandPaletteTaskHits,
    resolveCommandPaletteVisibility,
    resolveCreateTaskIntent,
    selectTaskIntent,
    switchProjectIntent,
    toggleThemeIntent,
} from "./rules";

const baseContext = (
    overrides: Partial<CommandPaletteRouteContext> = {}
): CommandPaletteRouteContext => ({
    boardId: null,
    canCreateTasks: false,
    projectId: null,
    ...overrides,
});

describe("Command Palette rules seam — visibility", () => {
    it.each([
        {
            boardId: null,
            canCreateTasks: true,
            expected: false,
            label: "hidden without boardId even when canCreateTasks",
        },
        {
            boardId: "board-1",
            canCreateTasks: false,
            expected: false,
            label: "hidden with boardId when cannot create Tasks",
        },
        {
            boardId: "board-1",
            canCreateTasks: true,
            expected: true,
            label: "shown with boardId and canCreateTasks",
        },
    ] as const)(
        "Create Task: $label",
        ({ boardId, canCreateTasks, expected }) => {
            const visibility = resolveCommandPaletteVisibility(
                baseContext({ boardId, canCreateTasks }),
                []
            );

            expect(visibility.createTask).toBe(expected);
        }
    );

    it.each([
        { expected: false, label: "hidden without projectId", projectId: null },
        {
            expected: true,
            label: "shown with projectId",
            projectId: "project-1",
        },
    ] as const)("Tasks section: $label", ({ expected, projectId }) => {
        const visibility = resolveCommandPaletteVisibility(
            baseContext({ projectId }),
            []
        );

        expect(visibility.tasks).toBe(expected);
    });

    it("Toggle theme is always available in Actions", () => {
        const visibility = resolveCommandPaletteVisibility(baseContext(), []);

        expect(visibility.toggleTheme).toBe(true);
    });

    it.each([
        {
            expected: false,
            label: "hidden when no accessible Projects",
            projects: [] as CommandPaletteProject[],
        },
        {
            expected: true,
            label: "shown when accessible Projects exist",
            projects: [{ id: "p1", name: "Alpha" }],
        },
    ] as const)("Switch Project: $label", ({ expected, projects }) => {
        const visibility = resolveCommandPaletteVisibility(
            baseContext(),
            projects
        );

        expect(visibility.switchProject).toBe(expected);
    });
});

describe("Command Palette rules seam — Task search", () => {
    const tasks: CommandPaletteTask[] = [
        {
            boardId: "b1",
            id: "t1",
            key: "TASK-1",
            title: "Login page",
        },
        {
            boardId: "b1",
            id: "t2",
            key: "TASK-2",
            title: "Fix login redirect",
        },
        {
            archivedAt: "2026-01-01T00:00:00Z",
            boardId: "b1",
            id: "t3",
            key: "TASK-3",
            title: "Archived login",
        },
        {
            boardId: "b2",
            id: "t4",
            key: "BUG-9",
            title: "Crash on save",
        },
    ];

    it("returns no hits when query length is less than 1", () => {
        expect(matchCommandPaletteTasks(tasks, "")).toEqual([]);
        expect(matchCommandPaletteTasks(tasks, "   ")).toEqual([]);
    });

    it("matches by key and title, excluding archived Tasks", () => {
        const hits = matchCommandPaletteTasks(tasks, "login");

        expect(hits.map((task) => task.id)).toEqual(["t1", "t2"]);
    });

    it("ranks exact key matches, then title matches, then partial key matches", () => {
        const ranked = matchCommandPaletteTasks(
            [
                {
                    boardId: "b1",
                    id: "key-partial",
                    key: "BUG-90",
                    title: "Unrelated",
                },
                {
                    boardId: "b1",
                    id: "title-hit",
                    key: "TASK-99",
                    title: "Mentions BUG-9 in title",
                },
                {
                    boardId: "b1",
                    id: "key-exact",
                    key: "BUG-9",
                    title: "Something else",
                },
            ],
            "BUG-9"
        );

        expect(ranked.map((task) => task.id)).toEqual([
            "key-exact",
            "title-hit",
            "key-partial",
        ]);
    });

    it("caps results at 20", () => {
        const many: CommandPaletteTask[] = Array.from(
            { length: 25 },
            (_, index) => ({
                boardId: "b1",
                id: `id-${index}`,
                key: `TASK-${index}`,
                title: `Item ${index} alpha`,
            })
        );

        expect(matchCommandPaletteTasks(many, "alpha")).toHaveLength(20);
    });

    it("returns no Task hits without Project context even when query matches", () => {
        expect(
            resolveCommandPaletteTaskHits(
                baseContext({ projectId: null }),
                tasks,
                "login"
            )
        ).toEqual([]);
    });

    it("returns ranked Task hits when Project context is present", () => {
        expect(
            resolveCommandPaletteTaskHits(
                baseContext({ projectId: "project-1" }),
                tasks,
                "login"
            ).map((task) => task.id)
        ).toEqual(["t1", "t2"]);
    });
});

describe("Command Palette rules seam — intents", () => {
    it("select Task declares navigate intent with boardId and taskId", () => {
        expect(selectTaskIntent({ boardId: "board-9", id: "task-9" })).toEqual({
            boardId: "board-9",
            taskId: "task-9",
            type: "select-task",
        });
    });

    it("Create Task declares create intent with boardId and title", () => {
        expect(createTaskIntent("board-1", "New login")).toEqual({
            boardId: "board-1",
            title: "New login",
            type: "create-task",
        });
    });

    it.each([
        {
            boardId: null,
            canCreateTasks: true,
            expected: null,
            label: "hidden without boardId",
            query: "New login",
        },
        {
            boardId: "board-1",
            canCreateTasks: false,
            expected: null,
            label: "hidden without canCreateTasks",
            query: "New login",
        },
        {
            boardId: "board-1",
            canCreateTasks: true,
            expected: null,
            label: "hidden when title is empty",
            query: "   ",
        },
        {
            boardId: "board-1",
            canCreateTasks: true,
            expected: {
                boardId: "board-1",
                title: "New login",
                type: "create-task" as const,
            },
            label: "offered with boardId, canCreateTasks, and trimmed title",
            query: "  New login  ",
        },
    ])(
        "resolveCreateTaskIntent: $label",
        ({ boardId, canCreateTasks, expected, query }) => {
            expect(
                resolveCreateTaskIntent(
                    baseContext({ boardId, canCreateTasks }),
                    query
                )
            ).toEqual(expected);
        }
    );

    it("Switch Project declares switch intent with projectId", () => {
        expect(switchProjectIntent("project-7")).toEqual({
            projectId: "project-7",
            type: "switch-project",
        });
    });

    it("Toggle theme declares theme intent", () => {
        expect(toggleThemeIntent()).toEqual({ type: "toggle-theme" });
    });
});
