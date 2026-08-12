import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import type { BoardTasksCache } from "@/features/tasks/api/tasks-api";

import { isGuest } from "@/features/guest-mode";
import { resolveSprintsProvider } from "@/features/sprints/api/resolve-sprints-provider";
import { createMutationQueue } from "@/features/sprints/model/create-mutation-queue";
import { invalidateSprintBoardCaches } from "@/features/sprints/model/invalidate-sprint-board";
import {
    applySprintMembershipUpdates,
    planSprintMembershipMove,
} from "@/features/sprints/model/plan-sprint-membership-move";
import { sprintKeys } from "@/features/sprints/model/query-keys";
import { setTasksCache } from "@/features/tasks/model/board-query-cache";
import { taskKeys } from "@/features/tasks/model/query-keys";

export function useBoardSprints(boardId: string) {
    const provider = resolveSprintsProvider(isGuest());

    return useQuery({
        enabled: Boolean(boardId),
        queryFn: () => provider.fetchBoardSprints(boardId),
        queryKey: sprintKeys.board(boardId),
    });
}

export function useSprintEvents(sprintId: string | undefined) {
    const provider = resolveSprintsProvider(isGuest());

    return useQuery({
        enabled: Boolean(sprintId),
        queryFn: () => provider.fetchSprintEvents(sprintId!),
        queryKey: sprintKeys.events(sprintId ?? ""),
    });
}

export function useSprintMutations(projectId: string, boardId: string) {
    const queryClient = useQueryClient();
    const provider = resolveSprintsProvider(isGuest());
    const moveQueueReference = useRef(createMutationQueue());

    const createDraft = useMutation({
        mutationFn: ({ goal, name }: { goal?: string; name: string }) =>
            provider.createDraftSprint(boardId, projectId, name, goal),
        onSuccess: () =>
            invalidateSprintBoardCaches(queryClient, projectId, boardId),
    });

    const renameDraft = useMutation({
        mutationFn: ({
            goal,
            name,
            sprintId,
        }: {
            goal?: null | string;
            name?: string;
            sprintId: string;
        }) => provider.updateDraftSprint(sprintId, { goal, name }),
        onSuccess: () =>
            invalidateSprintBoardCaches(queryClient, projectId, boardId),
    });

    const removeDraft = useMutation({
        mutationFn: (sprintId: string) =>
            provider.deleteEmptyDraftSprint(sprintId),
        onSuccess: () =>
            invalidateSprintBoardCaches(queryClient, projectId, boardId),
    });

    const removePast = useMutation({
        mutationFn: (sprintId: string) => provider.deletePastSprint(sprintId),
        onSuccess: (_data, sprintId) => {
            invalidateSprintBoardCaches(queryClient, projectId, boardId);
            queryClient.removeQueries({
                queryKey: sprintKeys.events(sprintId),
            });
        },
    });

    const moveTask = useMutation({
        mutationFn: ({
            sprintId,
            sprintPosition,
            taskId,
        }: {
            sprintId: null | string;
            sprintPosition: null | number;
            taskId: string;
        }) => provider.assignTaskToSprint(taskId, sprintId, sprintPosition),
        onSuccess: () =>
            invalidateSprintBoardCaches(queryClient, projectId, boardId),
    });

    const moveTasks = useMutation<
        void,
        Error,
        Array<{
            sprintId: null | string;
            sprintPosition: null | number;
            taskId: string;
        }>,
        { previous?: BoardTasksCache }
    >({
        mutationFn: (updates) => provider.assignTasksToSprint(updates),
        onError: (_error, _updates, context) => {
            if (context?.previous) {
                queryClient.setQueryData(
                    taskKeys.board(projectId, boardId),
                    context.previous
                );
            }
        },
        onMutate: async (updates) => {
            await queryClient.cancelQueries({
                queryKey: taskKeys.board(projectId, boardId),
            });
            const previous = queryClient.getQueryData<BoardTasksCache>(
                taskKeys.board(projectId, boardId)
            );
            setTasksCache(queryClient, projectId, boardId, (current) => ({
                ...current,
                tasks: applySprintMembershipUpdates(current.tasks, updates),
            }));
            return { previous };
        },
        onSettled: () => {
            invalidateSprintBoardCaches(queryClient, projectId, boardId);
        },
    });

    const moveTasksToSprint = (
        taskIds: readonly string[],
        targetSprintId: null | string
    ) =>
        moveQueueReference.current.enqueue(async () => {
            const cache = queryClient.getQueryData<BoardTasksCache>(
                taskKeys.board(projectId, boardId)
            );
            if (!cache) return [];

            const updates = planSprintMembershipMove({
                targetSprintId,
                taskIds,
                tasks: cache.tasks,
            });
            if (updates.length === 0) return [];

            await moveTasks.mutateAsync(updates);
            return updates;
        });

    const start = useMutation({
        mutationFn: ({
            endsOn,
            sprintId,
            startsOn,
        }: {
            endsOn: string;
            sprintId: string;
            startsOn: string;
        }) => provider.startSprint(sprintId, startsOn, endsOn),
        onSuccess: () =>
            invalidateSprintBoardCaches(queryClient, projectId, boardId),
    });

    const close = useMutation({
        mutationFn: ({
            carryoverByTaskId,
            completedTaskIds,
            sprintId,
        }: {
            carryoverByTaskId: Record<string, null | string>;
            completedTaskIds: string[];
            sprintId: string;
        }) =>
            provider.closeSprint(sprintId, completedTaskIds, carryoverByTaskId),
        onSuccess: (_data, variables) => {
            invalidateSprintBoardCaches(queryClient, projectId, boardId);
            void queryClient.invalidateQueries({
                queryKey: sprintKeys.events(variables.sprintId),
            });
        },
    });

    const cancel = useMutation({
        mutationFn: (sprintId: string) => provider.cancelSprint(sprintId),
        onSuccess: (_data, sprintId) => {
            invalidateSprintBoardCaches(queryClient, projectId, boardId);
            void queryClient.invalidateQueries({
                queryKey: sprintKeys.events(sprintId),
            });
        },
    });

    return {
        cancel,
        close,
        createDraft,
        moveTask,
        moveTasks,
        moveTasksToSprint,
        removeDraft,
        removePast,
        renameDraft,
        start,
    };
}
