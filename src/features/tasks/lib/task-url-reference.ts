import type { QueryClient } from "@tanstack/react-query";

import type { BoardTasksCache } from "@/features/tasks/api/tasks-api";
import type { Task } from "@/features/tasks/model/types";

import { taskKeys } from "@/features/tasks/model/query-keys";
import { isUuid } from "@/shared/lib/is-uuid";

const TASK_KEY_PARAM_PATTERN = /^[A-Za-z]+-\d+$/;

export function findTaskByUrlReference(
    queryClient: QueryClient,
    projectId: string,
    reference: string
): Task | undefined {
    const normalized = reference.trim();
    if (!normalized) return undefined;

    return collectProjectTasks(queryClient, projectId).find((task) =>
        matchesTaskReference(task, normalized)
    );
}

/** Whether a `?task=` value is a human-readable key (`TASK-12`) rather than a UUID. */
export function isTaskKeyParameter(value: string): boolean {
    return TASK_KEY_PARAM_PATTERN.test(value.trim());
}

export function resolveTaskIdFromUrlReference(
    queryClient: QueryClient,
    projectId: string,
    reference: string | undefined
): string | undefined {
    if (!reference) return undefined;
    return findTaskByUrlReference(queryClient, projectId, reference)?.id;
}

export function resolveTaskKeyForUrl(
    queryClient: QueryClient,
    projectId: string,
    taskId: string
): string | undefined {
    return collectProjectTasks(queryClient, projectId).find(
        (task) => task.id === taskId
    )?.key;
}

function collectProjectTasks(
    queryClient: QueryClient,
    projectId: string
): Task[] {
    const tasks: Task[] = [];
    const seen = new Set<string>();

    const projectLists: Array<Task[] | undefined> = [
        queryClient.getQueryData<Task[]>(taskKeys.project(projectId, true)),
        queryClient.getQueryData<Task[]>(taskKeys.project(projectId, false)),
    ];

    for (const list of projectLists) {
        for (const task of list ?? []) {
            if (seen.has(task.id)) continue;
            seen.add(task.id);
            tasks.push(task);
        }
    }

    for (const [, cache] of queryClient.getQueriesData<BoardTasksCache>({
        queryKey: [...taskKeys.all, "board", projectId],
    })) {
        for (const task of cache?.tasks ?? []) {
            if (seen.has(task.id)) continue;
            seen.add(task.id);
            tasks.push(task);
        }
    }

    return tasks;
}

function matchesTaskReference(task: Task, reference: string): boolean {
    const normalized = reference.trim();
    if (!normalized) return false;
    if (isUuid(normalized)) {
        return task.id === normalized;
    }
    return task.key.toUpperCase() === normalized.toUpperCase();
}
