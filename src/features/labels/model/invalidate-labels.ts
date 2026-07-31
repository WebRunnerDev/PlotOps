import type { QueryClient } from "@tanstack/react-query";

import type { BoardTasksCache } from "@/features/tasks/api/tasks-api";
import type { Task } from "@/features/tasks/model/types";

import { taskKeys } from "@/features/tasks/model/query-keys";

import { labelKeys } from "./query-keys";

/** Refresh Project Labels only — not Board columns or Tasks. */
export function invalidateProjectLabels(
    queryClient: QueryClient,
    projectId: string
) {
    void queryClient.invalidateQueries({
        queryKey: labelKeys.project(projectId),
    });
}

/**
 * After label delete/move, strip the removed id from cached task.labelIds so
 * filters and drawers do not keep orphan associations until the next refetch.
 */
export function stripLabelIdFromTaskCaches(
    queryClient: QueryClient,
    projectId: string,
    labelId: string
) {
    const stripFromTask = (task: Task): Task => {
        if (!task.labelIds?.includes(labelId)) return task;
        const nextIds = task.labelIds.filter((id) => id !== labelId);
        return {
            ...task,
            labelIds: nextIds.length > 0 ? nextIds : undefined,
        };
    };

    queryClient.setQueriesData<BoardTasksCache>(
        { queryKey: [...taskKeys.all, "board", projectId] },
        (current) => {
            if (!current) return current;
            return {
                ...current,
                tasks: current.tasks.map((task) => stripFromTask(task)),
            };
        }
    );

    queryClient.setQueriesData<Task[]>(
        { queryKey: taskKeys.project(projectId) },
        (current) => current?.map((task) => stripFromTask(task))
    );
}
