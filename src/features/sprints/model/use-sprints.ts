import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
    assignTasksToSprint,
    assignTaskToSprint,
    cancelSprint,
    closeSprint,
    createDraftSprint,
    deleteEmptyDraftSprint,
    deletePastSprint,
    fetchBoardSprints,
    fetchSprintEvents,
    startSprint,
    updateDraftSprint,
} from "@/features/sprints/api/sprints-api";
import { invalidateSprintBoardCaches } from "@/features/sprints/model/invalidate-sprint-board";
import { sprintKeys } from "@/features/sprints/model/query-keys";

export function useBoardSprints(boardId: string) {
    return useQuery({
        queryFn: () => fetchBoardSprints(boardId),
        queryKey: sprintKeys.board(boardId),
    });
}

export function useSprintEvents(sprintId: string | undefined) {
    return useQuery({
        enabled: Boolean(sprintId),
        queryFn: () => fetchSprintEvents(sprintId!),
        queryKey: sprintKeys.events(sprintId ?? ""),
    });
}

export function useSprintMutations(projectId: string, boardId: string) {
    const queryClient = useQueryClient();

    const createDraft = useMutation({
        mutationFn: ({ goal, name }: { goal?: string; name: string }) =>
            createDraftSprint(boardId, projectId, name, goal),
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
        }) => updateDraftSprint(sprintId, { goal, name }),
        onSuccess: () =>
            invalidateSprintBoardCaches(queryClient, projectId, boardId),
    });

    const removeDraft = useMutation({
        mutationFn: (sprintId: string) => deleteEmptyDraftSprint(sprintId),
        onSuccess: () =>
            invalidateSprintBoardCaches(queryClient, projectId, boardId),
    });

    const removePast = useMutation({
        mutationFn: (sprintId: string) => deletePastSprint(sprintId),
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
        }) => assignTaskToSprint(taskId, sprintId, sprintPosition),
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
        ) => assignTasksToSprint(updates),
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
        }) => startSprint(sprintId, startsOn, endsOn),
        onSuccess: () =>
            invalidateSprintBoardCaches(queryClient, projectId, boardId),
    });

    const close = useMutation({
        mutationFn: ({
            carryoverSprintId,
            completedTaskIds,
            sprintId,
        }: {
            carryoverSprintId: null | string;
            completedTaskIds: string[];
            sprintId: string;
        }) => closeSprint(sprintId, completedTaskIds, carryoverSprintId),
        onSuccess: (_data, variables) => {
            invalidateSprintBoardCaches(queryClient, projectId, boardId);
            void queryClient.invalidateQueries({
                queryKey: sprintKeys.events(variables.sprintId),
            });
        },
    });

    const cancel = useMutation({
        mutationFn: (sprintId: string) => cancelSprint(sprintId),
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
