import type {
    BoardTasksCache,
    TaskRecordPatch,
} from "@/features/tasks/api/tasks-api";
import type { Task, TaskStatus, TaskType } from "@/features/tasks/model/types";

/**
 * Narrow Tasks data seam for Guest vs Supabase resolution.
 * Happy-path: board/project reads + create / edit / move / status DnD + archive/delete.
 */
export type TasksProvider = {
    archiveTaskRecord(taskId: string): Promise<void>;
    createTaskRecord(
        projectId: string,
        boardId: string,
        status: TaskStatus,
        title: string,
        taskType?: TaskType,
        sprintId?: string
    ): Promise<Task>;
    deleteTaskRecord(taskId: string): Promise<void>;
    fetchArchivedTasks(boardId: string): Promise<Task[]>;
    fetchBoardTasks(boardId: string): Promise<BoardTasksCache>;
    fetchProjectTasks(
        projectId: string,
        options?: { includeArchived?: boolean }
    ): Promise<Task[]>;
    moveTaskToBoard(
        taskId: string,
        targetBoardId: string,
        targetStatus: TaskStatus
    ): Promise<{ status: TaskStatus }>;
    persistTaskMoves(
        boardId: string,
        updates: Array<{ id: string; position: number; status: TaskStatus }>
    ): Promise<void>;
    restoreTaskRecord(taskId: string, boardId: string): Promise<void>;
    updateTaskDetails(
        taskId: string,
        patch: TaskRecordPatch,
        labelIds?: null | string[]
    ): Promise<void>;
    updateTaskRecord(taskId: string, patch: TaskRecordPatch): Promise<void>;
};
