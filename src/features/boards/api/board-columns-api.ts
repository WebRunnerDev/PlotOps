import type { BoardColumn } from "@/features/boards/model/types";

import { DEFAULT_KANBAN_COLUMNS } from "@/features/boards/model/constants";
import { supabase } from "@/shared/api/supabase";

import { type DatabaseBoardColumn, mapDatabaseColumn } from "./board-mappers";

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
    return id;
}

/**
 * Deletes a Board column. When `moveTasksTo` is set, Tasks (including archived)
 * on that column are re-pointed first so status ids are not left dangling.
 */
export async function deleteBoardColumn(
    boardId: string,
    columnId: string,
    moveTasksTo?: string
) {
    if (moveTasksTo) {
        const { error: moveError } = await supabase
            .from("tasks")
            .update({ status: moveTasksTo })
            .eq("board_id", boardId)
            .eq("status", columnId)
            .is("archived_at", null);

        if (moveError) throw moveError;

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

export async function fetchBoardColumnIds(boardId: string): Promise<string[]> {
    const columns = await fetchBoardColumnSummaries(boardId);
    return columns.map((column) => column.id);
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

/** Lightweight column list for move-to-Board UI (no default-column seed). */
export async function fetchBoardColumnSummaries(
    boardId: string
): Promise<BoardColumn[]> {
    const { data, error } = await supabase
        .from("board_columns")
        .select("id, name")
        .eq("board_id", boardId)
        .order("position", { ascending: true });

    if (error) throw error;
    return (data ?? []).map((row) => ({
        id: row.id as string,
        name: row.name as string,
    }));
}

export async function renameBoardColumn(
    boardId: string,
    columnId: string,
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
    columnIds: string[]
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
