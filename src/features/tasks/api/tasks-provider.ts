import type {
    BoardTasksCache,
    TaskRecordPatch,
} from "@/features/tasks/api/tasks-api";
import type { Task, TaskStatus, TaskType } from "@/features/tasks/model/types";

/**
 * Narrow Tasks data seam for Guest vs Supabase resolution.
 * Happy-path: board/project reads + create / edit / move / status DnD.
 */
export type TasksProvider = {
    createTaskRecord(
        projectId: string,
        boardId: string,
        status: TaskStatus,
        title: string,
        taskType?: TaskType,
        sprintId?: string
    ): Promise<Task>;
    fetchBoardTasks(boardId: string): Promise<BoardTasksCache>;
    fetchProjectTasks(projectId: string): Promise<Task[]>;
    moveTaskToBoard(
        taskId: string,
        targetBoardId: string,
        targetStatus: TaskStatus
    ): Promise<{ status: TaskStatus }>;
    persistTaskMoves(
        boardId: string,
        updates: Array<{ id: string; position: number; status: TaskStatus }>
    ): Promise<void>;
    updateTaskDetails(
        taskId: string,
        patch: TaskRecordPatch,
        labelIds?: null | string[]
    ): Promise<void>;
    updateTaskRecord(taskId: string, patch: TaskRecordPatch): Promise<void>;
};
