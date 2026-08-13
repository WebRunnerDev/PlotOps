/**
 * Task hierarchy rules (ADR 0023): one Parent/Subtask level, same Project.
 * Guest sandbox and client UX call this; Postgres RPCs re-implement the same checks.
 */

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

export const PARENT_LINK_ERROR: Record<ParentLinkRefusal, string> = {
    child_is_parent: "A Parent Task cannot become a Subtask",
    different_project: "Parent Task and Subtask must be in the same Project",
    parent_is_subtask: "A Subtask cannot have Subtasks",
    parent_missing: "Parent Task not found",
    self: "A Task cannot be a Subtask of itself",
};

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
