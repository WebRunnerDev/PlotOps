/**
 * Task hierarchy rules (ADR 0023): one Parent/Subtask level, same Project.
 * Guest sandbox and client UX call this; Postgres RPCs re-implement the same checks.
 */

export type ParentArchiveRefusal = "active_subtasks";

export type ParentDeleteRefusal = "subtasks_exist";

export type ParentDoneRefusal = "incomplete_subtasks";

export type ParentGateTask = {
    archivedAt?: string;
    id: string;
    isDone: boolean;
    parentId?: string;
};

export type ParentLinkRefusal =
    | "child_is_parent"
    | "different_project"
    | "parent_is_subtask"
    | "parent_missing"
    | "self";

/** Proposed child may be a new Task (no id yet) or an existing root Task. */
export type ProposedChild = {
    id?: string;
    parentId?: string;
    projectId: string;
};

export type TaskStructureNode = {
    id: string;
    parentId?: string;
    projectId: string;
};

export const PARENT_GATE_ERROR: Record<
    ParentArchiveRefusal | ParentDeleteRefusal | ParentDoneRefusal,
    string
> = {
    active_subtasks:
        "A Parent Task cannot be archived while Subtasks are still active",
    incomplete_subtasks:
        "A Parent Task cannot enter Done while Subtasks are not Done",
    subtasks_exist: "A Parent Task cannot be deleted while Subtasks exist",
};

export const PARENT_GATE_TOAST_KEY: Record<
    ParentArchiveRefusal | ParentDeleteRefusal | ParentDoneRefusal,
    | "subtasks.archiveRefused"
    | "subtasks.deleteRefused"
    | "subtasks.doneRefused"
> = {
    active_subtasks: "subtasks.archiveRefused",
    incomplete_subtasks: "subtasks.doneRefused",
    subtasks_exist: "subtasks.deleteRefused",
};

export const PARENT_LINK_ERROR: Record<ParentLinkRefusal, string> = {
    child_is_parent: "A Parent Task cannot become a Subtask",
    different_project: "Parent Task and Subtask must be in the same Project",
    parent_is_subtask: "A Subtask cannot have Subtasks",
    parent_missing: "Parent Task not found",
    self: "A Task cannot be a Subtask of itself",
};

export function assertParentArchiveLegal(
    taskId: string,
    tasks: readonly ParentGateTask[]
): void {
    const reason = parentArchiveRefusal(taskId, tasks);
    if (reason) {
        throw new Error(PARENT_GATE_ERROR[reason]);
    }
}

export function assertParentDeleteLegal(
    taskId: string,
    tasks: readonly ParentGateTask[]
): void {
    const reason = parentDeleteRefusal(taskId, tasks);
    if (reason) {
        throw new Error(PARENT_GATE_ERROR[reason]);
    }
}

export function assertParentDoneLegal(
    taskId: string,
    tasks: readonly ParentGateTask[]
): void {
    const reason = parentDoneRefusal(taskId, tasks);
    if (reason) {
        throw new Error(PARENT_GATE_ERROR[reason]);
    }
}

export function assertParentLinkLegal(
    child: ProposedChild,
    parent: TaskStructureNode | undefined,
    tasks: readonly TaskStructureNode[]
): void {
    const reason = parentLinkRefusal(child, parent, tasks);
    if (reason) {
        throw new Error(PARENT_LINK_ERROR[reason]);
    }
}

export function parentArchiveRefusal(
    taskId: string,
    tasks: readonly ParentGateTask[]
): null | ParentArchiveRefusal {
    const children = subtasksOf(taskId, tasks);
    if (children.some((child) => child.archivedAt === undefined)) {
        return "active_subtasks";
    }
    return null;
}

export function parentDeleteRefusal(
    taskId: string,
    tasks: readonly ParentGateTask[]
): null | ParentDeleteRefusal {
    if (subtasksOf(taskId, tasks).length > 0) {
        return "subtasks_exist";
    }
    return null;
}

export function parentDoneRefusal(
    taskId: string,
    tasks: readonly ParentGateTask[]
): null | ParentDoneRefusal {
    const children = subtasksOf(taskId, tasks).filter(
        (child) => child.archivedAt === undefined
    );
    if (children.some((child) => !child.isDone)) {
        return "incomplete_subtasks";
    }
    return null;
}

export function parentGateRefusalFromError(
    error: unknown
): null | ParentArchiveRefusal | ParentDeleteRefusal | ParentDoneRefusal {
    const message =
        error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "";
    if (!message) return null;
    for (const reason of Object.keys(PARENT_GATE_ERROR) as Array<
        keyof typeof PARENT_GATE_ERROR
    >) {
        if (message.includes(PARENT_GATE_ERROR[reason])) {
            return reason;
        }
    }
    return null;
}

export function parentLinkRefusal(
    child: ProposedChild,
    parent: TaskStructureNode | undefined,
    tasks: readonly TaskStructureNode[]
): null | ParentLinkRefusal {
    if (!parent) {
        return "parent_missing";
    }

    if (child.id !== undefined && child.id === parent.id) {
        return "self";
    }

    if (child.projectId !== parent.projectId) {
        return "different_project";
    }

    if (parent.parentId !== undefined) {
        return "parent_is_subtask";
    }

    if (child.id !== undefined && hasSubtasks(child.id, tasks)) {
        return "child_is_parent";
    }

    return null;
}

export function subtasksOf<T extends { parentId?: string }>(
    parentId: string,
    tasks: readonly T[]
): T[] {
    return tasks.filter((task) => task.parentId === parentId);
}

function hasSubtasks(
    taskId: string,
    tasks: readonly TaskStructureNode[]
): boolean {
    return tasks.some((task) => task.parentId === taskId);
}
