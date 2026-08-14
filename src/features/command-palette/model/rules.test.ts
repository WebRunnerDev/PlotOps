import { describe, expect, it } from "vitest";

import {
    type CommandPaletteMember,
    type CommandPaletteProject,
    type CommandPaletteRouteContext,
    type CommandPaletteTask,
    createTaskIntent,
    matchCommandPaletteMembers,
    matchCommandPaletteTasks,
    openMemberSettingsIntent,
    resolveCommandPaletteMemberHits,
    resolveCommandPaletteTaskHits,
    resolveCommandPaletteVisibility,
    resolveCreateTaskIntent,
    resolveJumpTaskIntents,
    resolveNavigateIntent,
    selectTaskIntent,
    shouldRemindGuestCreateTask,
    switchProjectIntent,
    toggleThemeIntent,
} from "./rules";

const baseContext = (
    overrides: Partial<CommandPaletteRouteContext> = {}
): CommandPaletteRouteContext => ({
    boardId: null,
    canCreateTasks: false,
    canViewMembers: false,
    isGuest: false,
    projectId: null,
    teamId: null,
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

    it("guest keeps Create Task, Search Tasks, Switch Project, navigate, and Toggle theme under normal gates", () => {
        const visibility = resolveCommandPaletteVisibility(
            baseContext({
                boardId: "board-1",
                canCreateTasks: true,
                isGuest: true,
                projectId: "project-1",
            }),
            [{ id: "project-1", name: "Demo Board" }]
        );

        expect(visibility).toEqual({
            createTask: true,
            navigateBacklog: true,
            navigateBoard: true,
            navigateCicd: true,
            navigateSettings: true,
            searchMembers: false,
            switchProject: true,
            tasks: true,
            toggleTheme: true,
        });
    });

    it.each([
        {
            canViewMembers: true,
            expected: false,
            label: "hidden without teamId even when canViewMembers",
            teamId: null as null | string,
        },
        {
            canViewMembers: false,
            expected: false,
            label: "hidden with teamId when cannot view members",
            teamId: "team-1",
        },
        {
            canViewMembers: true,
            expected: true,
            label: "shown with teamId and canViewMembers",
            teamId: "team-1",
        },
    ] as const)(
        "Search Members: $label",
        ({ canViewMembers, expected, teamId }) => {
            const visibility = resolveCommandPaletteVisibility(
                baseContext({ canViewMembers, teamId }),
                []
            );

            expect(visibility.searchMembers).toBe(expected);
        }
    );

    it.each([
        {
            boardId: null,
            expected: {
                navigateBacklog: false,
                navigateBoard: false,
                navigateCicd: true,
                navigateSettings: true,
            },
            label: "CI/Settings with projectId only; Board/Backlog need boardId",
            projectId: "project-1",
        },
        {
            boardId: "board-1",
            expected: {
                navigateBacklog: true,
                navigateBoard: true,
                navigateCicd: true,
                navigateSettings: true,
            },
            label: "all TopBar sections when projectId and boardId present",
            projectId: "project-1",
        },
        {
            boardId: "board-1",
            expected: {
                navigateBacklog: false,
                navigateBoard: false,
                navigateCicd: false,
                navigateSettings: false,
            },
            label: "hidden without projectId even when boardId set",
            projectId: null,
        },
    ] as const)(
        "Navigate sections: $label",
        ({ boardId, expected, projectId }) => {
            const visibility = resolveCommandPaletteVisibility(
                baseContext({ boardId, projectId }),
                []
            );

            expect({
                navigateBacklog: visibility.navigateBacklog,
                navigateBoard: visibility.navigateBoard,
                navigateCicd: visibility.navigateCicd,
                navigateSettings: visibility.navigateSettings,
            }).toEqual(expected);
        }
    );

    it("guest still hides Create Task when board or create capability is missing", () => {
        expect(
            resolveCommandPaletteVisibility(
                baseContext({
                    boardId: null,
                    canCreateTasks: true,
                    isGuest: true,
                }),
                []
            ).createTask
        ).toBe(false);

        expect(
            resolveCommandPaletteVisibility(
                baseContext({
                    boardId: "board-1",
                    canCreateTasks: false,
                    isGuest: true,
                }),
                []
            ).createTask
        ).toBe(false);
    });

    it.each([
        { expected: true, isGuest: true, label: "guest sessions" },
        { expected: false, isGuest: false, label: "non-guest sessions" },
    ] as const)(
        "shouldRemindGuestCreateTask: $label",
        ({ expected, isGuest }) => {
            expect(shouldRemindGuestCreateTask(isGuest)).toBe(expected);
        }
    );
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

    it("includes archived Tasks when includeArchived is opted in", () => {
        const hits = matchCommandPaletteTasks(tasks, "login", {
            includeArchived: true,
        });

        expect(hits.map((task) => task.id)).toEqual(["t1", "t2", "t3"]);
    });

    it("still caps archived-inclusive results at 20", () => {
        const many: CommandPaletteTask[] = Array.from(
            { length: 25 },
            (_, index) => ({
                archivedAt: "2026-01-01T00:00:00Z",
                boardId: "b1",
                id: `id-${index}`,
                key: `TASK-${index}`,
                title: `Item ${index} alpha`,
            })
        );

        expect(
            matchCommandPaletteTasks(many, "alpha", { includeArchived: true })
        ).toHaveLength(20);
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

    it("passes includeArchived through resolveCommandPaletteTaskHits", () => {
        expect(
            resolveCommandPaletteTaskHits(
                baseContext({ projectId: "project-1" }),
                tasks,
                "login",
                { includeArchived: true }
            ).map((task) => task.id)
        ).toEqual(["t1", "t2", "t3"]);
    });
});

describe("Command Palette rules seam — Member search", () => {
    const members: CommandPaletteMember[] = [
        {
            displayName: "Ada Lovelace",
            userId: "u1",
            username: "ada",
        },
        {
            displayName: "Grace Hopper",
            userId: "u2",
            username: "ghopper",
        },
        {
            displayName: "Unknown user",
            userId: "u3",
            username: null,
        },
    ];

    it("returns no hits when query length is less than 1", () => {
        expect(matchCommandPaletteMembers(members, "")).toEqual([]);
        expect(matchCommandPaletteMembers(members, "   ")).toEqual([]);
    });

    it("matches display name and username", () => {
        expect(
            matchCommandPaletteMembers(members, "lovelace").map(
                (member) => member.userId
            )
        ).toEqual(["u1"]);

        expect(
            matchCommandPaletteMembers(members, "ghopper").map(
                (member) => member.userId
            )
        ).toEqual(["u2"]);
    });

    it("caps results at 20", () => {
        const many: CommandPaletteMember[] = Array.from(
            { length: 25 },
            (_, index) => ({
                displayName: `Person ${index}`,
                userId: `id-${index}`,
                username: `user${index}`,
            })
        );

        expect(matchCommandPaletteMembers(many, "person")).toHaveLength(20);
    });

    it("returns no Member hits without Team context or view capability", () => {
        expect(
            resolveCommandPaletteMemberHits(
                baseContext({ canViewMembers: true, teamId: null }),
                members,
                "ada"
            )
        ).toEqual([]);

        expect(
            resolveCommandPaletteMemberHits(
                baseContext({ canViewMembers: false, teamId: "team-1" }),
                members,
                "ada"
            )
        ).toEqual([]);
    });

    it("returns Member hits when Team context and view capability are present", () => {
        expect(
            resolveCommandPaletteMemberHits(
                baseContext({ canViewMembers: true, teamId: "team-1" }),
                members,
                "ada"
            ).map((member) => member.userId)
        ).toEqual(["u1"]);
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

    it("open Member settings declares intent with teamId and userId", () => {
        expect(openMemberSettingsIntent("team-1", "user-9")).toEqual({
            teamId: "team-1",
            type: "open-member-settings",
            userId: "user-9",
        });
    });

    it("Create Task declares create intent with boardId, title, and default type task", () => {
        expect(createTaskIntent("board-1", "New login")).toEqual({
            boardId: "board-1",
            taskType: "task",
            title: "New login",
            type: "create-task",
        });
    });

    it.each([
        {
            expected: {
                boardId: "board-1",
                taskType: "bug" as const,
                title: "Crash",
                type: "create-task" as const,
            },
            taskType: "bug" as const,
            title: "Crash",
        },
        {
            expected: {
                boardId: "board-1",
                taskType: "feature" as const,
                title: "Dark mode",
                type: "create-task" as const,
            },
            taskType: "feature" as const,
            title: "Dark mode",
        },
    ])(
        "Create Task declares create intent with taskType $taskType",
        ({ expected, taskType, title }) => {
            expect(createTaskIntent("board-1", title, taskType)).toEqual(
                expected
            );
        }
    );

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
                taskType: "task" as const,
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

    it.each([
        {
            expected: {
                boardId: "board-1",
                taskType: "bug" as const,
                title: "Crash on save",
                type: "create-task" as const,
            },
            taskType: "bug" as const,
        },
        {
            expected: {
                boardId: "board-1",
                taskType: "feature" as const,
                title: "Crash on save",
                type: "create-task" as const,
            },
            taskType: "feature" as const,
        },
    ])(
        "resolveCreateTaskIntent threads taskType $taskType through create gate",
        ({ expected, taskType }) => {
            expect(
                resolveCreateTaskIntent(
                    baseContext({
                        boardId: "board-1",
                        canCreateTasks: true,
                    }),
                    "Crash on save",
                    taskType
                )
            ).toEqual(expected);
        }
    );

    it("resolveCreateTaskIntent still offers Create Task for guests when gates pass", () => {
        expect(
            resolveCreateTaskIntent(
                baseContext({
                    boardId: "board-1",
                    canCreateTasks: true,
                    isGuest: true,
                }),
                "Demo card"
            )
        ).toEqual({
            boardId: "board-1",
            taskType: "task",
            title: "Demo card",
            type: "create-task",
        });
    });

    it.each([
        {
            boardId: "board-1",
            expected: {
                boardId: "board-1",
                projectId: "project-1",
                section: "board" as const,
                type: "navigate" as const,
            },
            projectId: "project-1",
            section: "board" as const,
        },
        {
            boardId: "board-1",
            expected: {
                boardId: "board-1",
                projectId: "project-1",
                section: "backlog" as const,
                type: "navigate" as const,
            },
            projectId: "project-1",
            section: "backlog" as const,
        },
        {
            boardId: null,
            expected: {
                projectId: "project-1",
                section: "cicd" as const,
                type: "navigate" as const,
            },
            projectId: "project-1",
            section: "cicd" as const,
        },
        {
            boardId: null,
            expected: {
                projectId: "project-1",
                section: "settings" as const,
                type: "navigate" as const,
            },
            projectId: "project-1",
            section: "settings" as const,
        },
    ])(
        "resolveNavigateIntent: $section when context allows",
        ({ boardId, expected, projectId, section }) => {
            expect(
                resolveNavigateIntent(
                    baseContext({ boardId, projectId }),
                    section
                )
            ).toEqual(expected);
        }
    );

    it.each([
        {
            boardId: null,
            label: "Board without boardId",
            projectId: "project-1",
            section: "board" as const,
        },
        {
            boardId: null,
            label: "Backlog without boardId",
            projectId: "project-1",
            section: "backlog" as const,
        },
        {
            boardId: "board-1",
            label: "CI without projectId",
            projectId: null,
            section: "cicd" as const,
        },
        {
            boardId: "board-1",
            label: "Settings without projectId",
            projectId: null,
            section: "settings" as const,
        },
    ])(
        "resolveNavigateIntent: null for $label",
        ({ boardId, projectId, section }) => {
            expect(
                resolveNavigateIntent(
                    baseContext({ boardId, projectId }),
                    section
                )
            ).toBeNull();
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

describe("Command Palette rules seam — jump to Parent and blockers", () => {
    const parent = {
        boardId: "board-parent",
        id: "parent-1",
        key: "TASK-1",
        title: "Parent",
    };
    const blocker = {
        boardId: "board-b",
        id: "blocker-1",
        key: "TASK-9",
        title: "Blocker",
    };
    const doneBlocker = {
        boardId: "board-b",
        id: "blocker-done",
        isDone: true,
        key: "TASK-10",
        title: "Done blocker",
    };
    const archivedBlocker = {
        archivedAt: "2026-01-01T00:00:00Z",
        boardId: "board-b",
        id: "blocker-archived",
        key: "TASK-11",
        title: "Archived blocker",
    };
    const subtask = {
        boardId: "board-child",
        id: "child-1",
        key: "TASK-2",
        parentId: "parent-1",
        relatedTasks: [
            {
                direction: "incoming" as const,
                kind: "blocks" as const,
                otherId: "blocker-1",
            },
            {
                direction: "incoming" as const,
                kind: "blocks" as const,
                otherId: "blocker-done",
            },
            {
                direction: "incoming" as const,
                kind: "blocks" as const,
                otherId: "blocker-archived",
            },
            {
                direction: "outgoing" as const,
                kind: "blocks" as const,
                otherId: "downstream",
            },
            {
                direction: "incoming" as const,
                kind: "relates_to" as const,
                otherId: "related-1",
            },
        ],
        title: "Child",
    };
    const catalog = [
        parent,
        blocker,
        doneBlocker,
        archivedBlocker,
        subtask,
        {
            boardId: "board-b",
            id: "downstream",
            key: "TASK-20",
            title: "Downstream",
        },
        {
            boardId: "board-b",
            id: "related-1",
            key: "TASK-21",
            title: "Related",
        },
    ];

    it("offers no jumps without a focused Task", () => {
        expect(resolveJumpTaskIntents(null, catalog)).toEqual([]);
        expect(resolveJumpTaskIntents(undefined, catalog)).toEqual([]);
    });

    it("offers Go to Parent as select-task when the focused Task is a Subtask", () => {
        const jumps = resolveJumpTaskIntents("child-1", catalog);
        const parentJump = jumps.find((jump) => jump.kind === "parent");

        expect(parentJump).toEqual({
            intent: {
                boardId: "board-parent",
                taskId: "parent-1",
                type: "select-task",
            },
            kind: "parent",
            targetKey: "TASK-1",
        });
    });

    it("omits Go to Parent when the focused Task is not a Subtask", () => {
        expect(
            resolveJumpTaskIntents("parent-1", catalog).some(
                (jump) => jump.kind === "parent"
            )
        ).toBe(false);
    });

    it("omits Go to Parent when the Parent Task is not in the catalog", () => {
        expect(
            resolveJumpTaskIntents("child-1", [subtask]).some(
                (jump) => jump.kind === "parent"
            )
        ).toBe(false);
    });

    it("offers one select-task jump per open blocking Task", () => {
        const blockerJumps = resolveJumpTaskIntents("child-1", catalog).filter(
            (jump) => jump.kind === "blocker"
        );

        expect(blockerJumps).toEqual([
            {
                intent: {
                    boardId: "board-b",
                    taskId: "blocker-1",
                    type: "select-task",
                },
                kind: "blocker",
                targetKey: "TASK-9",
            },
        ]);
    });

    it("omits blocker jumps when the focused Task has no open blocker", () => {
        expect(
            resolveJumpTaskIntents("child-1", [
                { ...subtask, hasOpenBlocker: false },
                blocker,
            ]).some((jump) => jump.kind === "blocker")
        ).toBe(false);
    });

    it("omits Done, archived, outgoing blocks, and relates-to peers", () => {
        const ids = resolveJumpTaskIntents("child-1", catalog).map(
            (jump) => jump.intent.taskId
        );

        expect(ids).not.toContain("blocker-done");
        expect(ids).not.toContain("blocker-archived");
        expect(ids).not.toContain("downstream");
        expect(ids).not.toContain("related-1");
    });

    it("jump actions are select-task only (no create Subtask or add link)", () => {
        for (const jump of resolveJumpTaskIntents("child-1", catalog)) {
            expect(jump.intent.type).toBe("select-task");
        }
    });
});
