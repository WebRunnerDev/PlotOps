import type { Sprint, SprintEvent } from "@/features/sprints/model/types";

/**
 * Sprint read/write surface for the backlog + lifecycle UI.
 * Prefer `resolveSprintsProvider(isGuest)` at call sites so Guest Sessions
 * hit the local sandbox without scattering `if (isGuest)` through hooks.
 */
export type SprintsProvider = {
    assignTasksToSprint: (
        updates: Array<{
            sprintId: null | string;
            sprintPosition: null | number;
            taskId: string;
        }>
    ) => Promise<void>;
    assignTaskToSprint: (
        taskId: string,
        sprintId: null | string,
        sprintPosition: null | number
    ) => Promise<void>;
    cancelSprint: (sprintId: string) => Promise<Sprint>;
    closeSprint: (
        sprintId: string,
        completedTaskIds: string[],
        carryoverSprintId: null | string
    ) => Promise<Sprint>;
    createDraftSprint: (
        boardId: string,
        projectId: string,
        name: string,
        goal?: string
    ) => Promise<Sprint>;
    deleteEmptyDraftSprint: (sprintId: string) => Promise<void>;
    deletePastSprint: (sprintId: string) => Promise<void>;
    fetchBoardSprints: (boardId: string) => Promise<Sprint[]>;
    fetchSprintEvents: (sprintId: string) => Promise<SprintEvent[]>;
    reorderSprintMembership: (
        updates: Array<{ id: string; sprintPosition: number }>
    ) => Promise<void>;
    startSprint: (
        sprintId: string,
        startsOn: string,
        endsOn: string
    ) => Promise<Sprint>;
    updateDraftSprint: (
        sprintId: string,
        patch: { goal?: null | string; name?: string }
    ) => Promise<void>;
};
