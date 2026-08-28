import type { Task } from "@/features/tasks/model/types";

import { parentLinkRefusal } from "@/features/tasks/lib/task-structure";

/** Root Tasks in the Project that may become the Parent of `childId`. */
export function collectParentTaskCandidates(input: {
    childId: string;
    projectId: string;
    tasks: readonly Task[];
}): Task[] {
    const child = input.tasks.find((item) => item.id === input.childId);
    if (!child || child.parentId != undefined) return [];

    const nodes = input.tasks.map((item) => ({
        id: item.id,
        parentId: item.parentId,
        projectId: input.projectId,
    }));

    return input.tasks.filter((item) => {
        if (item.archivedAt || item.id === input.childId) return false;
        if (item.parentId != undefined) return false;
        return (
            parentLinkRefusal(
                {
                    id: child.id,
                    parentId: child.parentId,
                    projectId: input.projectId,
                },
                {
                    id: item.id,
                    parentId: item.parentId,
                    projectId: input.projectId,
                },
                nodes
            ) === null
        );
    });
}

/** Root Tasks in the Project that may become Subtasks of `parentId`. */
export function collectSubtaskLinkCandidates(input: {
    parentId: string;
    projectId: string;
    tasks: readonly Task[];
}): Task[] {
    const parent = input.tasks.find((item) => item.id === input.parentId);
    const nodes = input.tasks.map((item) => ({
        id: item.id,
        parentId: item.parentId,
        projectId: input.projectId,
    }));
    const parentNode = parent
        ? {
              id: parent.id,
              parentId: parent.parentId,
              projectId: input.projectId,
          }
        : undefined;

    return input.tasks.filter((item) => {
        if (item.archivedAt || item.id === input.parentId) return false;
        if (item.parentId != undefined) return false;
        return (
            parentLinkRefusal(
                {
                    id: item.id,
                    parentId: item.parentId,
                    projectId: input.projectId,
                },
                parentNode,
                nodes
            ) === null
        );
    });
}
