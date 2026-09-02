export type CommandPaletteFocusedTask = {
    archivedAt?: null | string;
    boardId: string;
    hasOpenBlocker?: boolean;
    id: string;
    isDone?: boolean;
    key: string;
    parentId?: string;
    relatedTasks?: readonly CommandPaletteRelatedTask[];
};

export type CommandPaletteIntent =
    | { boardId: string; taskId: string; taskKey: string; type: "select-task" }
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
    | { teamId: string; type: "open-member-settings"; userId: string }
    | { type: "toggle-theme" };

export type CommandPaletteJumpAction = {
    intent: Extract<CommandPaletteIntent, { type: "select-task" }>;
    kind: CommandPaletteJumpKind;
    targetKey: string;
};

export type CommandPaletteJumpKind = "blocker" | "parent";

export type CommandPaletteMember = {
    displayName: string;
    userId: string;
    username: null | string;
};

export type CommandPaletteNavigateSection =
    "archive" | "backlog" | "board" | "cicd" | "settings";

export type CommandPaletteProject = {
    id: string;
    name: string;
};

export type CommandPaletteRelatedTask = {
    direction: "incoming" | "outgoing";
    kind: "blocks" | "relates_to";
    otherId: string;
};

export type CommandPaletteRouteContext = {
    boardId: null | string;
    canCreateTasks: boolean;
    /** Role that may view Team members (same surface as Team settings). */
    canViewMembers: boolean;
    /** Guest Session — Create Task allowed against the local sandbox. */
    isGuest: boolean;
    projectId: null | string;
    teamId: null | string;
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
    navigateArchive: boolean;
    navigateBacklog: boolean;
    navigateBoard: boolean;
    navigateCicd: boolean;
    navigateSettings: boolean;
    searchMembers: boolean;
    switchProject: boolean;
    tasks: boolean;
    toggleTheme: boolean;
};

const MAX_MEMBER_HITS = 20;
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

export function matchCommandPaletteMembers(
    members: readonly CommandPaletteMember[],
    query: string
): CommandPaletteMember[] {
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) {
        return [];
    }

    const hits: CommandPaletteMember[] = [];

    for (const member of members) {
        const displayName = member.displayName.toLowerCase();
        const username = member.username?.toLowerCase() ?? "";
        if (
            displayName.includes(normalized) ||
            (username.length > 0 && username.includes(normalized))
        ) {
            hits.push(member);
        }
    }

    return hits.slice(0, MAX_MEMBER_HITS);
}

export function matchCommandPaletteTasks(
    tasks: readonly CommandPaletteTask[],
    query: string,
    options?: { includeArchived?: boolean }
): CommandPaletteTask[] {
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) {
        return [];
    }

    const includeArchived = options?.includeArchived === true;
    const exactKey: CommandPaletteTask[] = [];
    const titleHits: CommandPaletteTask[] = [];
    const partialKey: CommandPaletteTask[] = [];

    for (const task of tasks) {
        if (task.archivedAt && !includeArchived) {
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

export function openMemberSettingsIntent(
    teamId: string,
    userId: string
): Extract<CommandPaletteIntent, { type: "open-member-settings" }> {
    return {
        teamId,
        type: "open-member-settings",
        userId,
    };
}

/** Member hits — empty without Team context or view-members capability. */
export function resolveCommandPaletteMemberHits(
    context: CommandPaletteRouteContext,
    members: readonly CommandPaletteMember[],
    query: string
): CommandPaletteMember[] {
    if (!(context.teamId && context.canViewMembers)) {
        return [];
    }
    return matchCommandPaletteMembers(members, query);
}

/** Task hits for the palette — empty without Project context; otherwise rules matching. */
export function resolveCommandPaletteTaskHits(
    context: CommandPaletteRouteContext,
    tasks: readonly CommandPaletteTask[],
    query: string,
    options?: { includeArchived?: boolean }
): CommandPaletteTask[] {
    if (!context.projectId) {
        return [];
    }
    return matchCommandPaletteTasks(tasks, query, options);
}

export function resolveCommandPaletteVisibility(
    context: CommandPaletteRouteContext,
    projects: readonly CommandPaletteProject[]
): CommandPaletteVisibility {
    const hasProject = Boolean(context.projectId);
    const hasBoard = Boolean(context.boardId);

    return {
        createTask: canOfferCreateTask(context),
        navigateArchive: hasProject && hasBoard,
        navigateBacklog: hasProject && hasBoard,
        navigateBoard: hasProject && hasBoard,
        navigateCicd: hasProject,
        navigateSettings: hasProject,
        searchMembers: Boolean(context.teamId) && context.canViewMembers,
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
 * Jump offers for the focused/open Task: Parent (Subtask only) and each
 * open blocking Task. Always `select-task` — no create Subtask or add link.
 */
export function resolveJumpTaskIntents(
    focusedTaskId: null | string | undefined,
    tasks: readonly CommandPaletteFocusedTask[]
): CommandPaletteJumpAction[] {
    if (!focusedTaskId) {
        return [];
    }

    const focused = tasks.find((task) => task.id === focusedTaskId);
    if (!focused) {
        return [];
    }

    const byId = new Map(tasks.map((task) => [task.id, task]));
    const jumps: CommandPaletteJumpAction[] = [];

    if (focused.parentId) {
        const parent = byId.get(focused.parentId);
        if (parent) {
            jumps.push({
                intent: selectTaskIntent(parent),
                kind: "parent",
                targetKey: parent.key,
            });
        }
    }

    for (const peer of focused.relatedTasks ?? []) {
        if (peer.kind !== "blocks" || peer.direction !== "incoming") {
            continue;
        }
        if (focused.hasOpenBlocker === false) {
            continue;
        }
        const blocker = byId.get(peer.otherId);
        if (!isOpenBlockingTask(blocker)) {
            continue;
        }
        jumps.push({
            intent: selectTaskIntent(blocker),
            kind: "blocker",
            targetKey: blocker.key,
        });
    }

    return jumps;
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

    if (section === "board" || section === "backlog" || section === "archive") {
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
    task: Pick<CommandPaletteTask, "boardId" | "id" | "key">
): Extract<CommandPaletteIntent, { type: "select-task" }> {
    return {
        boardId: task.boardId,
        taskId: task.id,
        taskKey: task.key,
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

function isOpenBlockingTask(
    task: CommandPaletteFocusedTask | undefined
): task is CommandPaletteFocusedTask {
    if (!task || task.archivedAt) {
        return false;
    }
    return task.isDone !== true;
}
