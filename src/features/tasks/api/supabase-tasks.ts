import type { TasksProvider } from "@/features/tasks/api/tasks-provider";

import {
    createTaskRecord,
    fetchBoardTasks,
    fetchProjectTasks,
    moveTaskToBoard,
    persistTaskMoves,
    updateTaskDetails,
    updateTaskRecord,
} from "@/features/tasks/api/tasks-api";

/** Real-account Tasks adapter — delegates to existing Supabase APIs. */
export const supabaseTasksProvider: TasksProvider = {
    createTaskRecord,
    fetchBoardTasks,
    fetchProjectTasks,
    moveTaskToBoard,
    persistTaskMoves,
    updateTaskDetails,
    updateTaskRecord,
};
