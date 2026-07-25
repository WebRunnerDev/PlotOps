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
): Extract<CommandPaletteIntent, { type: "create-task" }> {
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

    const exactKey: CommandPaletteTask[] = [];
    const titleHits: CommandPaletteTask[] = [];
    const partialKey: CommandPaletteTask[] = [];

    for (const task of tasks) {
        if (task.archivedAt) {
            continue;
        }

        const key = task.key.toLowerCase();
        const title = task.title.toLowerCase();
        const keyMatch = key.includes(normalized);
        const titleMatch = title.includes(normalized);

        if (!keyMatch && !titleMatch) {
            continue;
        }

        if (key === normalized) {
            exactKey.push(task);
        } else if (titleMatch) {
            titleHits.push(task);
        } else {
            partialKey.push(task);
        }
    }

    return [...exactKey, ...titleHits, ...partialKey].slice(0, MAX_TASK_HITS);
}

/** Task hits for the palette — empty without Project context; otherwise rules matching. */
export function resolveCommandPaletteTaskHits(
    context: CommandPaletteRouteContext,
    tasks: readonly CommandPaletteTask[],
    query: string
): CommandPaletteTask[] {
    if (!context.projectId) {
        return [];
    }
    return matchCommandPaletteTasks(tasks, query);
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

/**
 * Create Task offer for the palette — null when hidden (no Board / no create
 * capability) or when the cmdk query has no title yet.
 */
export function resolveCreateTaskIntent(
    context: CommandPaletteRouteContext,
    query: string
): Extract<CommandPaletteIntent, { type: "create-task" }> | null {
    if (!context.boardId || !context.canCreateTasks) {
        return null;
    }
    const title = query.trim();
    if (!title) {
        return null;
    }
    return createTaskIntent(context.boardId, title);
}

export function selectTaskIntent(
    task: Pick<CommandPaletteTask, "boardId" | "id">
): Extract<CommandPaletteIntent, { type: "select-task" }> {
    return {
        boardId: task.boardId,
        taskId: task.id,
        type: "select-task",
    };
}

export function switchProjectIntent(
    projectId: string
): Extract<CommandPaletteIntent, { type: "switch-project" }> {
    return {
        projectId,
        type: "switch-project",
    };
}

export function toggleThemeIntent(): CommandPaletteIntent {
    return { type: "toggle-theme" };
}
