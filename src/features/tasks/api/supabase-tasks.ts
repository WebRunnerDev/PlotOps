import type { TasksProvider } from "@/features/tasks/api/tasks-provider";

import {
    archiveTaskRecord,
    archiveTaskRecords,
    clearTaskParent,
    createSubtaskRecord,
    createTaskRecord,
    deleteTaskRecord,
    fetchArchivedTasks,
    fetchBoardTasks,
    fetchProjectTasks,
    moveTaskToBoard,
    persistTaskMoves,
    restoreTaskRecord,
    updateTaskDetails,
    updateTaskRecord,
} from "@/features/tasks/api/tasks-api";

/** Real-account Tasks adapter — delegates to existing Supabase APIs. */
export const supabaseTasksProvider: TasksProvider = {
    archiveTaskRecord,
    archiveTaskRecords,
    clearTaskParent,
    createSubtaskRecord,
    createTaskRecord,
    deleteTaskRecord,
    fetchArchivedTasks,
    fetchBoardTasks,
    fetchProjectTasks,
    moveTaskToBoard,
    persistTaskMoves,
    restoreTaskRecord,
    updateTaskDetails,
    updateTaskRecord,
};
