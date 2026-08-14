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
    archiveTaskRecords(taskIds: string[]): Promise<{ archivedCount: number }>;
    clearTaskParent(taskId: string): Promise<Task>;
    createSubtaskRecord(
        parentId: string,
        title: string,
        taskType?: TaskType,
        sprintId?: string
    ): Promise<Task>;
    createTaskLinkRecord(
        sourceTaskId: string,
        targetTaskId: string,
        kind: "relates_to"
    ): Promise<Task>;
    createTaskRecord(
        projectId: string,
        boardId: string,
        status: TaskStatus,
        title: string,
        taskType?: TaskType,
        sprintId?: string
    ): Promise<Task>;
    deleteTaskLinkRecord(linkId: string): Promise<void>;
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
