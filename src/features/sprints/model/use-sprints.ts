import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isGuest } from "@/features/guest-mode";
import { resolveSprintsProvider } from "@/features/sprints/api/resolve-sprints-provider";
import { invalidateSprintBoardCaches } from "@/features/sprints/model/invalidate-sprint-board";
import { sprintKeys } from "@/features/sprints/model/query-keys";

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

    const moveTasks = useMutation({
        mutationFn: (
            updates: Array<{
                sprintId: null | string;
                sprintPosition: null | number;
                taskId: string;
            }>
        ) => provider.assignTasksToSprint(updates),
        onSuccess: () =>
            invalidateSprintBoardCaches(queryClient, projectId, boardId),
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
        removeDraft,
        removePast,
        renameDraft,
        start,
    };
}
