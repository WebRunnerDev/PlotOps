import type { SprintsProvider } from "@/features/sprints/api/sprints-provider";

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
    reorderSprintMembership,
    startSprint,
    updateDraftSprint,
} from "@/features/sprints/api/sprints-api";

/** Non-Guest Sprint provider — existing Supabase API surface. */
export const supabaseSprintsProvider: SprintsProvider = {
    assignTasksToSprint,
    assignTaskToSprint,
    cancelSprint,
    closeSprint,
    createDraftSprint,
    deleteEmptyDraftSprint,
    deletePastSprint,
    fetchBoardSprints,
    fetchSprintEvents,
    reorderSprintMembership,
    startSprint,
    updateDraftSprint,
};
