import { DEFAULT_KANBAN_COLUMNS } from "@/features/tasks/model/constants";
import type {
    BoardColumn,
    LabelColor,
    ProjectLabel,
    Task,
    TaskPriority,
    TaskStatus,
} from "@/features/tasks/model/types";
import { supabase } from "@/shared/api/supabase";

import {
    mapDbColumn,
    mapDbLabel,
    mapDbTask,
    sortColumns,
    sortTasksByPosition,
    type DbBoardColumn,
    type DbLabel,
    type DbTask,
} from "./board-mappers";

export type ProjectBoard = {
    columns: BoardColumn[];
    labels: ProjectLabel[];
    taskPositions: Map<string, number>;
    tasks: Task[];
};

const TASK_SELECT = `
  id,
  project_id,
  title,
  description,
  status,
  priority,
  deadline,
  branch_name,
  assignee_id,
  position,
  pr_number,
  pr_state,
  pr_url,
  created_at,
  assignee:profiles!tasks_assignee_id_fkey (
    id,
    username,
    avatar_url
  ),
  task_labels (
    label_id
  )
`;

async function ensureDefaultColumns(projectId: string) {
    const { count, error } = await supabase
        .from("board_columns")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId);

    if (error) throw error;
    if ((count ?? 0) > 0) return;

    const rows = DEFAULT_KANBAN_COLUMNS.map((column, index) => ({
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

export async function fetchProjectBoard(projectId: string): Promise<ProjectBoard> {
    await ensureDefaultColumns(projectId);

    const [columnsResult, labelsResult, tasksResult] = await Promise.all([
        supabase
            .from("board_columns")
            .select("id, project_id, name, position")
            .eq("project_id", projectId)
            .order("position", { ascending: true }),
        supabase
            .from("labels")
            .select("id, project_id, name, color, custom_color")
            .eq("project_id", projectId)
            .order("name", { ascending: true }),
        supabase
            .from("tasks")
            .select(TASK_SELECT)
            .eq("project_id", projectId)
            .order("position", { ascending: true })
            .order("created_at", { ascending: true }),
    ]);

    if (columnsResult.error) throw columnsResult.error;
    if (labelsResult.error) throw labelsResult.error;
    if (tasksResult.error) throw tasksResult.error;

    const columnRows = (columnsResult.data ?? []) as DbBoardColumn[];
    const labelRows = (labelsResult.data ?? []) as DbLabel[];
    const taskRows = (tasksResult.data ?? []) as DbTask[];

    const columns = columnRows.map(mapDbColumn);
    const labels = labelRows.map(mapDbLabel);
    const tasks = taskRows.map(mapDbTask);
    const taskPositions = new Map(
        taskRows.map((row) => [row.id, row.position] as const),
    );

    return {
        columns,
        labels,
        taskPositions,
        tasks: sortTasksByPosition(tasks, taskPositions),
    };
}

export async function createBoardColumn(projectId: string, name: string) {
    const id = `col_${crypto.randomUUID().slice(0, 8)}`;

    const { data: existing, error: existingError } = await supabase
        .from("board_columns")
        .select("position")
        .eq("project_id", projectId)
        .order("position", { ascending: false })
        .limit(1);

    if (existingError) throw existingError;

    const position = (existing?.[0]?.position ?? -1) + 1;

    const { error } = await supabase.from("board_columns").insert({
        id,
        name,
        position,
        project_id: projectId,
    });

    if (error) throw error;
    return id as TaskStatus;
}

export async function renameBoardColumn(
    projectId: string,
    columnId: TaskStatus,
    name: string,
) {
    const { error } = await supabase
        .from("board_columns")
        .update({ name })
        .eq("project_id", projectId)
        .eq("id", columnId);

    if (error) throw error;
}

export async function deleteBoardColumn(
    projectId: string,
    columnId: TaskStatus,
    moveTasksTo?: TaskStatus,
) {
    if (moveTasksTo) {
        const { error: moveError } = await supabase
            .from("tasks")
            .update({ status: moveTasksTo })
            .eq("project_id", projectId)
            .eq("status", columnId);

        if (moveError) throw moveError;
    }

    const { error } = await supabase
        .from("board_columns")
        .delete()
        .eq("project_id", projectId)
        .eq("id", columnId);

    if (error) throw error;
}

export async function reorderBoardColumns(
    projectId: string,
    columnIds: TaskStatus[],
) {
    const updates = columnIds.map((id, position) =>
        supabase
            .from("board_columns")
            .update({ position })
            .eq("project_id", projectId)
            .eq("id", id),
    );

    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
}

export async function createTaskRecord(
    projectId: string,
    status: TaskStatus,
    title: string,
) {
    const { data: existing, error: existingError } = await supabase
        .from("tasks")
        .select("position")
        .eq("project_id", projectId)
        .eq("status", status)
        .order("position", { ascending: false })
        .limit(1);

    if (existingError) throw existingError;

    const position = (existing?.[0]?.position ?? -1) + 1;

    const { data, error } = await supabase
        .from("tasks")
        .insert({
            position,
            project_id: projectId,
            status,
            title: title.trim(),
        })
        .select(TASK_SELECT)
        .single();

    if (error) throw error;
    return mapDbTask(data as DbTask);
}

export async function updateTaskRecord(
    taskId: string,
    patch: {
        branch_name?: string | null;
        deadline?: string | null;
        description?: string | null;
        position?: number;
        priority?: TaskPriority | null;
        status?: TaskStatus;
        title?: string;
    },
) {
    const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
    if (error) throw error;
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
        })),
    );

    if (insertError) throw insertError;
}

export async function persistTaskMoves(
    projectId: string,
    updates: Array<{ id: string; position: number; status: TaskStatus }>,
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
                .eq("project_id", projectId),
        ),
    );

    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
}

export async function createProjectLabel(
    projectId: string,
    name: string,
    color: LabelColor,
    customColor?: string,
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
    return mapDbLabel(data as DbLabel);
}

export async function updateProjectLabel(
    labelId: string,
    patch: {
        color?: LabelColor;
        custom_color?: string | null;
        name?: string;
        project_id?: string;
    },
) {
    const { error } = await supabase.from("labels").update(patch).eq("id", labelId);
    if (error) throw error;
}

export async function deleteProjectLabel(labelId: string) {
    const { error } = await supabase.from("labels").delete().eq("id", labelId);
    if (error) throw error;
}

export function orderColumnsByIds(
    columns: BoardColumn[],
    columnIds: TaskStatus[],
): BoardColumn[] {
    const byId = new Map(columns.map((column) => [column.id, column] as const));
    return columnIds
        .map((id) => byId.get(id))
        .filter((column): column is BoardColumn => column !== undefined);
}

export function buildColumnPositions(columns: DbBoardColumn[]) {
    return new Map(columns.map((column) => [column.id, column.position] as const));
}

export function sortBoardColumns(
    columns: BoardColumn[],
    positions: Map<string, number>,
) {
    return sortColumns(columns, positions);
}
