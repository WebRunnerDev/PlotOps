/**
 * Task hierarchy and Task Link rules (ADR 0023): one Parent/Subtask level;
 * peer `blocks` / `relates to` links stay in the same Project and are not
 * Parent↔Subtask. Cyclic `blocks` chains are rejected. Guest sandbox and
 * client UX call this; Postgres RPCs re-implement the same checks.
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

export type TaskDoneRefusal = "open_blocker" | ParentDoneRefusal;

export type TaskLinkEdge = {
    kind: TaskLinkKind;
    sourceId: string;
    targetId: string;
};

export type TaskLinkKind = "blocks" | "relates_to";

export type TaskLinkRefusal =
    | "blocks_cycle"
    | "different_project"
    | "duplicate"
    | "parent_subtask"
    | "self"
    | "task_missing";

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

export const TASK_DONE_ERROR: Record<TaskDoneRefusal, string> = {
    incomplete_subtasks: PARENT_GATE_ERROR.incomplete_subtasks,
    open_blocker: "A Task cannot enter Done while an open blocker exists",
};

export const TASK_DONE_TOAST_KEY: Record<
    TaskDoneRefusal,
    "subtasks.doneRefused" | "taskLinks.blockedDoneRefused"
> = {
    incomplete_subtasks: "subtasks.doneRefused",
    open_blocker: "taskLinks.blockedDoneRefused",
};

export const TASK_LINK_ERROR: Record<TaskLinkRefusal, string> = {
    blocks_cycle: "A cyclic blocks chain is not allowed",
    different_project: "Task Links must stay inside the same Project",
    duplicate: "These Tasks are already linked",
    parent_subtask:
        "A Task Link cannot connect a Parent Task and its own Subtask",
    self: "A Task cannot relate to itself",
    task_missing: "Task not found",
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

export function assertTaskDoneLegal(
    taskId: string,
    tasks: readonly ParentGateTask[],
    links: readonly TaskLinkEdge[]
): void {
    const reason = taskDoneRefusal(taskId, tasks, links);
    if (reason) {
        throw new Error(TASK_DONE_ERROR[reason]);
    }
}

export function assertTaskLinkLegal(
    sourceId: string,
    targetId: string,
    kind: TaskLinkKind,
    tasks: readonly TaskStructureNode[],
    existing: readonly TaskLinkEdge[]
): void {
    const reason = taskLinkRefusal(sourceId, targetId, kind, tasks, existing);
    if (reason) {
        throw new Error(TASK_LINK_ERROR[reason]);
    }
}

export function hasOpenBlocker(
    taskId: string,
    tasks: readonly ParentGateTask[],
    links: readonly TaskLinkEdge[]
): boolean {
    const byId = new Map(tasks.map((task) => [task.id, task]));
    return links.some((link) => {
        if (link.kind !== "blocks" || link.targetId !== taskId) {
            return false;
        }
        const blocker = byId.get(link.sourceId);
        if (!blocker || blocker.archivedAt !== undefined) {
            return false;
        }
        return !blocker.isDone;
    });
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

export function taskDoneRefusal(
    taskId: string,
    tasks: readonly ParentGateTask[],
    links: readonly TaskLinkEdge[]
): null | TaskDoneRefusal {
    const parentReason = parentDoneRefusal(taskId, tasks);
    if (parentReason) {
        return parentReason;
    }
    if (hasOpenBlocker(taskId, tasks, links)) {
        return "open_blocker";
    }
    return null;
}

export function taskDoneRefusalFromError(
    error: unknown
): null | TaskDoneRefusal {
    const message =
        error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "";
    if (!message) return null;
    for (const reason of Object.keys(TASK_DONE_ERROR) as Array<
        keyof typeof TASK_DONE_ERROR
    >) {
        if (message.includes(TASK_DONE_ERROR[reason])) {
            return reason;
        }
    }
    return null;
}

export function taskLinkRefusal(
    sourceId: string,
    targetId: string,
    kind: TaskLinkKind,
    tasks: readonly TaskStructureNode[],
    existing: readonly TaskLinkEdge[]
): null | TaskLinkRefusal {
    if (sourceId === targetId) {
        return "self";
    }

    const source = tasks.find((task) => task.id === sourceId);
    const target = tasks.find((task) => task.id === targetId);
    if (!source || !target) {
        return "task_missing";
    }

    if (source.projectId !== target.projectId) {
        return "different_project";
    }

    if (source.parentId === target.id || target.parentId === source.id) {
        return "parent_subtask";
    }

    const duplicate = existing.some((link) => {
        if (link.kind !== kind) {
            return false;
        }
        if (kind === "relates_to") {
            return (
                (link.sourceId === sourceId && link.targetId === targetId) ||
                (link.sourceId === targetId && link.targetId === sourceId)
            );
        }
        return link.sourceId === sourceId && link.targetId === targetId;
    });
    if (duplicate) {
        return "duplicate";
    }

    if (
        kind === "blocks" &&
        wouldCreateBlocksCycle(sourceId, targetId, existing)
    ) {
        return "blocks_cycle";
    }

    return null;
}

function hasSubtasks(
    taskId: string,
    tasks: readonly TaskStructureNode[]
): boolean {
    return tasks.some((task) => task.parentId === taskId);
}

function wouldCreateBlocksCycle(
    sourceId: string,
    targetId: string,
    existing: readonly TaskLinkEdge[]
): boolean {
    const outgoing = new Map<string, string[]>();
    for (const link of existing) {
        if (link.kind !== "blocks") continue;
        const next = outgoing.get(link.sourceId) ?? [];
        next.push(link.targetId);
        outgoing.set(link.sourceId, next);
    }

    const seen = new Set<string>();
    const queue = [targetId];
    while (queue.length > 0) {
        const current = queue.pop();
        if (current === undefined || seen.has(current)) continue;
        if (current === sourceId) {
            return true;
        }
        seen.add(current);
        const next = outgoing.get(current);
        if (next) {
            queue.push(...next);
        }
    }
    return false;
}
