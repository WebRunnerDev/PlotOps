import type {
    BoardColumn,
    LabelColor,
    ProjectLabel,
    Task,
    TaskPriority,
    TaskStatus,
    TaskType,
} from "@/features/tasks/model/types";

import { DEFAULT_KANBAN_COLUMNS } from "@/features/tasks/model/constants";
import { supabase } from "@/shared/api/supabase";

import {
    type DbBoardColumn as DatabaseBoardColumn,
    type DbLabel as DatabaseLabel,
    type DbTask as DatabaseTask,
    mapDbColumn as mapDatabaseColumn,
    mapDbLabel as mapDatabaseLabel,
    mapDbTask as mapDatabaseTask,
    sortColumns,
    sortTasksByPosition,
} from "./board-mappers";
import { fetchBoardColumnIds } from "./boards-api";

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

export function buildColumnPositions(columns: DatabaseBoardColumn[]) {
    return new Map(
        columns.map((column) => [column.id, column.position] as const)
    );
}

export async function createBoardColumn(
    projectId: string,
    boardId: string,
    name: string
) {
    const id = `col_${crypto.randomUUID().slice(0, 8)}`;

    const { data: existing, error: existingError } = await supabase
        .from("board_columns")
        .select("position")
        .eq("board_id", boardId)
        .order("position", { ascending: false })
        .limit(1);

    if (existingError) throw existingError;

    const position = (existing?.[0]?.position ?? -1) + 1;

    const { error } = await supabase.from("board_columns").insert({
        board_id: boardId,
        id,
        name,
        position,
        project_id: projectId,
    });

    if (error) throw error;
    return id as TaskStatus;
}

export async function createProjectLabel(
    projectId: string,
    name: string,
    color: LabelColor,
    customColor?: string
) {
    const { data, error } = await supabase
        .from("labels")
        .insert({
            color,
            custom_color: customColor ?? null,
            name,
            project_id: projectId,
        })
        .select("id, project_id, name, color, custom_color")
        .single();

    if (error) throw error;
    return mapDatabaseLabel(data as DatabaseLabel);
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

export async function deleteBoardColumn(
    boardId: string,
    columnId: TaskStatus,
    moveTasksTo?: TaskStatus
) {
    if (moveTasksTo) {
        const { error: moveError } = await supabase
            .from("tasks")
            .update({ status: moveTasksTo })
            .eq("board_id", boardId)
            .eq("status", columnId)
            .is("archived_at", null);

        if (moveError) throw moveError;

        // Archived tasks keep their column status for Restore; managers may
        // re-point them so a deleted column id is not left dangling.
        const { error: archivedMoveError } = await supabase
            .from("tasks")
            .update({ status: moveTasksTo })
            .eq("board_id", boardId)
            .eq("status", columnId)
            .not("archived_at", "is", null);

        if (archivedMoveError) throw archivedMoveError;
    }

    const { error } = await supabase
        .from("board_columns")
        .delete()
        .eq("board_id", boardId)
        .eq("id", columnId);

    if (error) throw error;
}

export async function deleteProjectLabel(labelId: string) {
    const { error } = await supabase.from("labels").delete().eq("id", labelId);
    if (error) throw error;
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

export async function fetchBoardColumns(
    projectId: string,
    boardId: string
): Promise<BoardColumn[]> {
    await ensureDefaultColumns(projectId, boardId);

    const { data, error } = await supabase
        .from("board_columns")
        .select("id, project_id, board_id, name, position")
        .eq("board_id", boardId)
        .order("position", { ascending: true });

    if (error) throw error;
    return ((data ?? []) as DatabaseBoardColumn[]).map((row) =>
        mapDatabaseColumn(row)
    );
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

/** Composes the three board workspace fetches (tests / one-shot loads). */
export async function fetchProjectBoard(
    projectId: string,
    boardId: string
): Promise<ProjectBoard> {
    const [columns, labels, tasksCache] = await Promise.all([
        fetchBoardColumns(projectId, boardId),
        fetchProjectLabels(projectId),
        fetchBoardTasks(boardId),
    ]);

    return {
        columns,
        labels,
        taskPositions: tasksCache.taskPositions,
        tasks: tasksCache.tasks,
    };
}

export async function fetchProjectLabels(
    projectId: string
): Promise<ProjectLabel[]> {
    const { data, error } = await supabase
        .from("labels")
        .select("id, project_id, name, color, custom_color")
        .eq("project_id", projectId)
        .order("name", { ascending: true });

    if (error) throw error;
    return ((data ?? []) as DatabaseLabel[]).map((row) =>
        mapDatabaseLabel(row)
    );
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

export function orderColumnsByIds(
    columns: BoardColumn[],
    columnIds: TaskStatus[]
): BoardColumn[] {
    const byId = new Map(columns.map((column) => [column.id, column] as const));
    return columnIds
        .map((id) => byId.get(id))
        .filter((column): column is BoardColumn => column !== undefined);
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

export async function renameBoardColumn(
    boardId: string,
    columnId: TaskStatus,
    name: string
) {
    const { error } = await supabase
        .from("board_columns")
        .update({ name })
        .eq("board_id", boardId)
        .eq("id", columnId);

    if (error) throw error;
}

export async function reorderBoardColumns(
    boardId: string,
    columnIds: TaskStatus[]
) {
    const updates = columnIds.map((id, position) =>
        supabase
            .from("board_columns")
            .update({ position })
            .eq("board_id", boardId)
            .eq("id", id)
    );

    const results = await Promise.all(updates);
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

export function sortBoardColumns(
    columns: BoardColumn[],
    positions: Map<string, number>
) {
    return sortColumns(columns, positions);
}

export async function updateProjectLabel(
    labelId: string,
    patch: {
        color?: LabelColor;
        custom_color?: null | string;
        name?: string;
        project_id?: string;
    }
) {
    const { error } = await supabase
        .from("labels")
        .update(patch)
        .eq("id", labelId);
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

async function ensureDefaultColumns(projectId: string, boardId: string) {
    const { count, error } = await supabase
        .from("board_columns")
        .select("id", { count: "exact", head: true })
        .eq("board_id", boardId);

    if (error) throw error;
    if ((count ?? 0) > 0) return;

    const rows = DEFAULT_KANBAN_COLUMNS.map((column, index) => ({
        board_id: boardId,
        id: column.id,
        name: column.name,
        position: index,
        project_id: projectId,
    }));

    const { error: insertError } = await supabase
        .from("board_columns")
        .insert(rows);

    if (insertError) throw insertError;
}
