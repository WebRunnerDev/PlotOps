export type CommandPaletteIntent =
    | { boardId: string; taskId: string; type: "select-task" }
    | { boardId: string; title: string; type: "create-task" }
    | { projectId: string; type: "switch-project" }
    | { type: "toggle-theme" };

export type CommandPaletteProject = {
    id: string;
    name: string;
};

export type CommandPaletteRouteContext = {
    boardId: null | string;
    canCreateTasks: boolean;
    projectId: null | string;
};

export type CommandPaletteTask = {
    archivedAt?: null | string;
    boardId: string;
    id: string;
    key: string;
    title: string;
};

export type CommandPaletteVisibility = {
    createTask: boolean;
    switchProject: boolean;
    tasks: boolean;
    toggleTheme: boolean;
};

const MAX_TASK_HITS = 20;

export function createTaskIntent(
    boardId: string,
    title: string
): CommandPaletteIntent {
    return {
        boardId,
        title,
        type: "create-task",
    };
}

export function matchCommandPaletteTasks(
    tasks: readonly CommandPaletteTask[],
    query: string
): CommandPaletteTask[] {
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) {
        return [];
    }

    const active = tasks.filter((task) => !task.archivedAt);
    const exactKey: CommandPaletteTask[] = [];
    const other: CommandPaletteTask[] = [];

    for (const task of active) {
        const key = task.key.toLowerCase();
        const title = task.title.toLowerCase();
        const keyMatch = key.includes(normalized);
        const titleMatch = title.includes(normalized);
        if (!keyMatch && !titleMatch) {
            continue;
        }
        if (key === normalized) {
            exactKey.push(task);
        } else {
            other.push(task);
        }
    }

    return [...exactKey, ...other].slice(0, MAX_TASK_HITS);
}

export function resolveCommandPaletteVisibility(
    context: CommandPaletteRouteContext,
    projects: readonly CommandPaletteProject[]
): CommandPaletteVisibility {
    return {
        createTask: Boolean(context.boardId) && context.canCreateTasks,
        switchProject: projects.length > 0,
        tasks: Boolean(context.projectId),
        toggleTheme: true,
    };
}

export function selectTaskIntent(
    task: Pick<CommandPaletteTask, "boardId" | "id">
): CommandPaletteIntent {
    return {
        boardId: task.boardId,
        taskId: task.id,
        type: "select-task",
    };
}

export function switchProjectIntent(projectId: string): CommandPaletteIntent {
    return {
        projectId,
        type: "switch-project",
    };
}

export function toggleThemeIntent(): CommandPaletteIntent {
    return { type: "toggle-theme" };
}
