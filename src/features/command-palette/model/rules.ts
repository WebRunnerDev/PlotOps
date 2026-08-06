export type CommandPaletteIntent =
    | { boardId: string; taskId: string; type: "select-task" }
    | {
          boardId: string;
          taskType: CommandPaletteTaskType;
          title: string;
          type: "create-task";
      }
    | {
          boardId?: string;
          projectId: string;
          section: CommandPaletteNavigateSection;
          type: "navigate";
      }
    | { projectId: string; type: "switch-project" }
    | { type: "toggle-theme" };

export type CommandPaletteNavigateSection =
    "backlog" | "board" | "cicd" | "settings";

export type CommandPaletteProject = {
    id: string;
    name: string;
};

export type CommandPaletteRouteContext = {
    boardId: null | string;
    canCreateTasks: boolean;
    /** Guest Session — Create Task allowed against the local sandbox. */
    isGuest: boolean;
    projectId: null | string;
};

export type CommandPaletteTask = {
    archivedAt?: null | string;
    boardId: string;
    id: string;
    key: string;
    title: string;
};

export type CommandPaletteTaskType = "bug" | "feature" | "task";

export type CommandPaletteVisibility = {
    createTask: boolean;
    navigateBacklog: boolean;
    navigateBoard: boolean;
    navigateCicd: boolean;
    navigateSettings: boolean;
    switchProject: boolean;
    tasks: boolean;
    toggleTheme: boolean;
};

const MAX_TASK_HITS = 20;

/**
 * Guests may Create Task in the palette against the local sandbox
 * (remind via shouldRemindGuestCreateTask that Reset clears mutations).
 */
export const GUEST_PALETTE_ALLOWS_CREATE_TASK = true;

export function createTaskIntent(
    boardId: string,
    title: string,
    taskType: CommandPaletteTaskType = "task"
): Extract<CommandPaletteIntent, { type: "create-task" }> {
    return {
        boardId,
        taskType,
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
    const hasProject = Boolean(context.projectId);
    const hasBoard = Boolean(context.boardId);

    return {
        createTask: canOfferCreateTask(context),
        navigateBacklog: hasProject && hasBoard,
        navigateBoard: hasProject && hasBoard,
        navigateCicd: hasProject,
        navigateSettings: hasProject,
        switchProject: projects.length > 0,
        tasks: hasProject,
        toggleTheme: true,
    };
}

/**
 * Create Task offer for the palette — null when hidden (no Board / no create
 * capability) or when the cmdk query has no title yet.
 */
export function resolveCreateTaskIntent(
    context: CommandPaletteRouteContext,
    query: string,
    taskType: CommandPaletteTaskType = "task"
): Extract<CommandPaletteIntent, { type: "create-task" }> | null {
    if (!canOfferCreateTask(context) || !context.boardId) {
        return null;
    }
    const title = query.trim();
    if (!title) {
        return null;
    }
    return createTaskIntent(context.boardId, title, taskType);
}

/**
 * Navigate offer for a TopBar section — null when projectId (and boardId for
 * Board / Backlog) are missing from URL context.
 */
export function resolveNavigateIntent(
    context: CommandPaletteRouteContext,
    section: CommandPaletteNavigateSection
): Extract<CommandPaletteIntent, { type: "navigate" }> | null {
    if (!context.projectId) {
        return null;
    }

    if (section === "board" || section === "backlog") {
        if (!context.boardId) {
            return null;
        }
        return {
            boardId: context.boardId,
            projectId: context.projectId,
            section,
            type: "navigate",
        };
    }

    return {
        projectId: context.projectId,
        section,
        type: "navigate",
    };
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

/**
 * Guest Create Task writes to the local sandbox (cleared on Leave / Reset).
 * Callers should remind that Reset demo can drop those mutations.
 */
export function shouldRemindGuestCreateTask(isGuest: boolean): boolean {
    return isGuest;
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

function canOfferCreateTask(context: CommandPaletteRouteContext): boolean {
    if (!context.boardId || !context.canCreateTasks) {
        return false;
    }
    if (context.isGuest && !GUEST_PALETTE_ALLOWS_CREATE_TASK) {
        return false;
    }
    return true;
}
