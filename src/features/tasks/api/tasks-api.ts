import type { BoardColumn } from "@/features/boards";
import type { ProjectLabel } from "@/features/labels";
import type {
    Task,
    TaskPriority,
    TaskStatus,
    TaskType,
} from "@/features/tasks/model/types";

import { fetchBoardColumnIds } from "@/features/boards";
import { supabase } from "@/shared/api/supabase";

import {
    type DatabaseTask,
    mapDatabaseTask,
    sortTasksByPosition,
} from "./board-mappers";

export type BoardTasksCache = {
    taskPositions: Map<string, number>;
    tasks: Task[];
};

export type ProjectBoard = {
    columns: BoardColumn[];
    labels: ProjectLabel[];
    taskPositions: Map<string, number>;
    tasks: Task[];
};

const TASK_SELECT = `
  id,
  project_id,
  board_id,
  sprint_id,
  sprint_position,
  title,
  description,
  status,
  priority,
  deadline,
  branch_name,
  assignee_id,
  author_id,
  archived_at,
  archived_by,
  position,
  pr_number,
  pr_state,
  pr_url,
  task_key,
  task_type,
  created_at,
  assignee:profiles!tasks_assignee_id_fkey (
    id,
    username,
    avatar_url
  ),
  author:profiles!tasks_author_id_fkey (
    id,
    username,
    avatar_url
  ),
  archived_by_profile:profiles!tasks_archived_by_fkey (
    id,
    username,
    avatar_url
  ),
  task_labels (
    label_id
  )
`;

/** Signal archive; DB trigger sets `archived_at` / `archived_by`. */
export async function archiveTaskRecord(taskId: string) {
    const { error } = await supabase
        .from("tasks")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", taskId)
        .is("archived_at", null);

    if (error) throw error;
}

export async function createTaskRecord(
    projectId: string,
    boardId: string,
    status: TaskStatus,
    title: string,
    taskType: TaskType = "task"
) {
    const { data: existing, error: existingError } = await supabase
        .from("tasks")
        .select("position")
        .eq("board_id", boardId)
        .eq("status", status)
        .is("archived_at", null)
        .order("position", { ascending: false })
        .limit(1);

    if (existingError) throw existingError;

    const position = (existing?.[0]?.position ?? -1) + 1;

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
        .from("tasks")
        .insert({
            author_id: user?.id ?? null,
            board_id: boardId,
            position,
            project_id: projectId,
            status,
            task_type: taskType,
            title: title.trim(),
        })
        .select(TASK_SELECT)
        .single();

    if (error) throw error;
    return mapDatabaseTask(data as DatabaseTask);
}

export async function deleteTaskRecord(taskId: string) {
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) throw error;
}

export async function fetchArchivedTasks(boardId: string): Promise<Task[]> {
    const { data, error } = await supabase
        .from("tasks")
        .select(TASK_SELECT)
        .eq("board_id", boardId)
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false });

    if (error) throw error;
    return ((data ?? []) as DatabaseTask[]).map((row) => mapDatabaseTask(row));
}

export async function fetchBoardTasks(
    boardId: string
): Promise<BoardTasksCache> {
    const { data, error } = await supabase
        .from("tasks")
        .select(TASK_SELECT)
        .eq("board_id", boardId)
        .is("archived_at", null)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });

    if (error) throw error;

    const taskRows = (data ?? []) as DatabaseTask[];
    const tasks = taskRows.map((row) => mapDatabaseTask(row));
    const taskPositions = new Map(
        taskRows.map((row) => [row.id, row.position] as const)
    );

    return {
        taskPositions,
        tasks: sortTasksByPosition(tasks, taskPositions),
    };
}

export async function moveTaskToBoard(
    taskId: string,
    targetBoardId: string,
    targetStatus: TaskStatus
) {
    const columnIds = await fetchBoardColumnIds(targetBoardId);
    if (columnIds.length === 0) {
        throw new Error("Target board has no columns");
    }
    if (!columnIds.includes(targetStatus)) {
        throw new Error("Target column is not on the destination board");
    }

    const { data: existing, error: existingError } = await supabase
        .from("tasks")
        .select("position")
        .eq("board_id", targetBoardId)
        .eq("status", targetStatus)
        .is("archived_at", null)
        .order("position", { ascending: false })
        .limit(1);

    if (existingError) throw existingError;

    const position = (existing?.[0]?.position ?? -1) + 1;

    const { error } = await supabase
        .from("tasks")
        .update({
            board_id: targetBoardId,
            position,
            status: targetStatus,
        })
        .eq("id", taskId);

    if (error) throw error;

    return { status: targetStatus };
}

export async function persistTaskMoves(
    boardId: string,
    updates: Array<{ id: string; position: number; status: TaskStatus }>
) {
    const results = await Promise.all(
        updates.map((item) =>
            supabase
                .from("tasks")
                .update({
                    position: item.position,
                    status: item.status,
                })
                .eq("id", item.id)
                .eq("board_id", boardId)
        )
    );

    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
}

export async function replaceTaskLabels(taskId: string, labelIds: string[]) {
    const { error: deleteError } = await supabase
        .from("task_labels")
        .delete()
        .eq("task_id", taskId);

    if (deleteError) throw deleteError;
    if (labelIds.length === 0) return;

    const { error: insertError } = await supabase.from("task_labels").insert(
        labelIds.map((labelId) => ({
            label_id: labelId,
            task_id: taskId,
        }))
    );

    if (insertError) throw insertError;
}

/** Restore to board; DB trigger clears archive columns. Re-appends to column. */
export async function restoreTaskRecord(taskId: string, boardId: string) {
    const { data: task, error: taskError } = await supabase
        .from("tasks")
        .select("status")
        .eq("id", taskId)
        .single();

    if (taskError) throw taskError;

    const status = task.status as TaskStatus;

    const { data: existing, error: existingError } = await supabase
        .from("tasks")
        .select("position")
        .eq("board_id", boardId)
        .eq("status", status)
        .is("archived_at", null)
        .order("position", { ascending: false })
        .limit(1);

    if (existingError) throw existingError;

    const position = (existing?.[0]?.position ?? -1) + 1;

    const { error } = await supabase
        .from("tasks")
        .update({
            archived_at: null,
            position,
        })
        .eq("id", taskId)
        .not("archived_at", "is", null);

    if (error) throw error;
}

export async function updateTaskRecord(
    taskId: string,
    patch: {
        assignee_id?: null | string;
        author_id?: null | string;
        board_id?: string;
        branch_name?: null | string;
        deadline?: null | string;
        description?: null | string;
        position?: number;
        pr_number?: null | number;
        pr_state?: null | string;
        pr_url?: null | string;
        priority?: null | TaskPriority;
        status?: TaskStatus;
        task_type?: TaskType;
        title?: string;
    }
) {
    const { error } = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", taskId);
    if (error) throw error;
}
