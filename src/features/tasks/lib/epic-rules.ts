import type {
    EpicColor,
    ProjectEpic,
    TaskStatus,
    TaskType,
} from "@/features/tasks/model/types";

/**
 * Epic hierarchy rules (ADR 0031) — mirrors `assert_task_epic_rules` so Guest
 * Mode and the UI refuse the same writes the server does, with the same text.
 */
export type EpicRefusal =
    | "archived_epic"
    | "archived_task"
    | "different_project"
    | "epic_has_members"
    | "epic_in_epic"
    | "epic_in_sprint"
    | "epic_is_subtask"
    | "epic_missing"
    | "epic_subtasks"
    | "manager_only"
    | "not_an_epic"
    | "parent_becomes_epic"
    | "subtask_epic";

export type EpicRuleTask = {
    archivedAt?: string;
    epicColor?: EpicColor;
    epicId?: string;
    estimate?: number;
    id: string;
    parentId?: string;
    projectId: string;
    sprintId?: string;
    type: TaskType;
};

export const EPIC_RULE_ERROR: Record<EpicRefusal, string> = {
    archived_epic: "Archived Epics cannot receive Tasks",
    archived_task: "Task is archived and cannot be modified",
    different_project: "Epic and Task must be in the same Project",
    epic_has_members: "An Epic with Tasks cannot change type",
    epic_in_epic: "An Epic cannot belong to an Epic",
    epic_in_sprint: "An Epic cannot join a Sprint",
    epic_is_subtask: "An Epic cannot be a Subtask",
    epic_missing: "Epic not found",
    epic_subtasks: "An Epic cannot have Subtasks",
    manager_only: "Only managers can create or convert Epics",
    not_an_epic: "Target Task is not an Epic",
    parent_becomes_epic: "A Parent Task cannot become an Epic",
    subtask_epic: "A Subtask belongs to its Parent Task's Epic",
};

/** i18n keys (namespace `board`) for toasts after a refused Epic write. */
export const EPIC_RULE_TOAST_KEY: Record<EpicRefusal, string> = {
    archived_epic: "epics.errors.archivedEpic",
    archived_task: "epics.errors.archivedTask",
    different_project: "epics.errors.differentProject",
    epic_has_members: "epics.errors.epicHasMembers",
    epic_in_epic: "epics.errors.epicInEpic",
    epic_in_sprint: "epics.errors.epicInSprint",
    epic_is_subtask: "epics.errors.epicIsSubtask",
    epic_missing: "epics.errors.epicMissing",
    epic_subtasks: "epics.errors.epicSubtasks",
    manager_only: "epics.errors.managerOnly",
    not_an_epic: "epics.errors.notAnEpic",
    parent_becomes_epic: "epics.errors.parentBecomesEpic",
    subtask_epic: "epics.errors.subtaskEpic",
};

export class EpicRuleError extends Error {
    readonly reason: EpicRefusal;

    constructor(reason: EpicRefusal) {
        super(EPIC_RULE_ERROR[reason]);
        this.name = "EpicRuleError";
        this.reason = reason;
    }
}

/**
 * Apply Epic rules to a proposed row (insert when `before` is undefined).
 * Returns the normalized row — the same silent clears the trigger performs —
 * or throws {@link EpicRuleError}.
 */
export function applyEpicRules<T extends EpicRuleTask>(
    before: EpicRuleTask | undefined,
    proposed: T,
    tasks: readonly EpicRuleTask[],
    options: { canManage: boolean }
): T {
    const next: T = { ...proposed };
    const typeChanged = before !== undefined && before.type !== next.type;
    const epicChanged = before === undefined || before.epicId !== next.epicId;
    const parentChanged =
        before === undefined || before.parentId !== next.parentId;

    if (
        before?.archivedAt !== undefined &&
        next.archivedAt !== undefined &&
        (before.epicColor !== next.epicColor ||
            (epicChanged && next.epicId !== undefined))
    ) {
        throw new EpicRuleError("archived_task");
    }

    if (
        typeChanged &&
        (next.type === "epic" || before.type === "epic") &&
        !options.canManage
    ) {
        throw new EpicRuleError("manager_only");
    }

    if (next.type === "epic") {
        if (next.parentId !== undefined) {
            throw new EpicRuleError("epic_is_subtask");
        }
        if (next.sprintId !== undefined) {
            throw new EpicRuleError("epic_in_sprint");
        }
        if (next.epicId !== undefined) {
            if (typeChanged && !epicChanged) {
                next.epicId = undefined;
            } else {
                throw new EpicRuleError("epic_in_epic");
            }
        }
        if (typeChanged && tasks.some((task) => task.parentId === next.id)) {
            throw new EpicRuleError("parent_becomes_epic");
        }
        next.estimate = undefined;
        return next;
    }

    next.epicColor = undefined;

    if (
        typeChanged &&
        before.type === "epic" &&
        tasks.some((task) => task.epicId === next.id)
    ) {
        throw new EpicRuleError("epic_has_members");
    }

    if (next.parentId !== undefined && parentChanged) {
        const parent = tasks.find((task) => task.id === next.parentId);
        if (parent?.type === "epic") {
            throw new EpicRuleError("epic_subtasks");
        }
    }

    if (next.parentId !== undefined && next.epicId !== undefined) {
        if (parentChanged && !epicChanged) {
            next.epicId = undefined;
        } else {
            throw new EpicRuleError("subtask_epic");
        }
    }

    if (next.epicId === undefined || !epicChanged) {
        return next;
    }

    const epic = tasks.find((task) => task.id === next.epicId);
    if (!epic) throw new EpicRuleError("epic_missing");
    if (epic.type !== "epic") throw new EpicRuleError("not_an_epic");
    if (epic.projectId !== next.projectId) {
        throw new EpicRuleError("different_project");
    }
    if (epic.archivedAt !== undefined) {
        throw new EpicRuleError("archived_epic");
    }

    return next;
}

/**
 * Why a Task cannot become an Epic right now (drawer Type picker), or null.
 * Only the checks the viewer can fix — permissions gate the picker separately.
 */
export function convertToEpicRefusal(
    task: Pick<EpicRuleTask, "id" | "parentId" | "sprintId" | "type">,
    tasks: readonly Pick<EpicRuleTask, "parentId">[]
): EpicRefusal | null {
    if (task.type === "epic") return null;
    if (task.parentId !== undefined) return "epic_is_subtask";
    if (task.sprintId !== undefined) return "epic_in_sprint";
    if (tasks.some((other) => other.parentId === task.id)) {
        return "parent_becomes_epic";
    }
    return null;
}

/** The Epic a Task counts toward: its own, or (Subtasks) its Parent's. */
export function effectiveEpicId(task: {
    epicId?: string;
    parentEpicId?: string;
}): string | undefined {
    return task.epicId ?? task.parentEpicId;
}

/** Map a server / Guest error to an Epic refusal, when it is one. */
export function epicRefusalFromError(error: unknown): EpicRefusal | null {
    if (error instanceof EpicRuleError) return error.reason;
    const message =
        typeof error === "string"
            ? error
            : error && typeof error === "object" && "message" in error
              ? String((error as { message: unknown }).message)
              : "";
    if (!message) return null;
    for (const reason of Object.keys(EPIC_RULE_ERROR) as EpicRefusal[]) {
        if (message.includes(EPIC_RULE_ERROR[reason])) {
            return reason;
        }
    }
    return null;
}

/** Guest / client rollup matching RPC `project_epics`. */
export function summarizeProjectEpics(
    tasks: readonly (EpicRuleTask & {
        boardId: string;
        createdAt: string;
        key: string;
        status: TaskStatus;
        title: string;
    })[],
    projectId: string,
    isDone: (boardId: string, status: TaskStatus) => boolean
): ProjectEpic[] {
    return tasks
        .filter((task) => task.projectId === projectId && task.type === "epic")
        .toSorted(
            (left, right) =>
                left.createdAt.localeCompare(right.createdAt) ||
                left.id.localeCompare(right.id)
        )
        .map((epic) => {
            const members = tasks.filter(
                (task) =>
                    task.epicId === epic.id && task.archivedAt === undefined
            );
            const done = members.filter((task) =>
                isDone(task.boardId, task.status)
            );
            return {
                archivedAt: epic.archivedAt,
                boardId: epic.boardId,
                color: epic.epicColor,
                doneCount: done.length,
                id: epic.id,
                isDone: isDone(epic.boardId, epic.status),
                key: epic.key,
                pointsDone: sumEstimates(done),
                pointsTotal: sumEstimates(members),
                status: epic.status,
                taskCount: members.length,
                title: epic.title,
                unestimatedCount: members.filter(
                    (task) => task.estimate === undefined
                ).length,
            };
        });
}

function sumEstimates(tasks: readonly { estimate?: number }[]): number {
    return tasks.reduce((sum, task) => sum + (task.estimate ?? 0), 0);
}
