import type { ProjectBoardRecord } from "@/features/boards/model/types";

import { supabase } from "@/shared/api/supabase";

type DatabaseBoard = {
    allowed_head_patterns: null | string[];
    base_branch: string;
    id: string;
    name: string;
    position: number;
    project_id: string;
};

export async function boardHasTasks(boardId: string): Promise<boolean> {
    const { count, error } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("board_id", boardId);

    if (error) throw error;
    return (count ?? 0) > 0;
}

export async function createBoard(
    projectId: string,
    name: string,
    baseBranch: string
) {
    const { data, error } = await supabase.rpc("create_board_with_columns", {
        p_base_branch: baseBranch || "main",
        p_name: name.trim() || "Board",
        p_project_id: projectId,
    });

    if (error) throw error;

    const row = data as DatabaseBoard | null;
    if (!row) {
        throw new Error("create_board_with_columns returned no board");
    }

    return mapDatabaseBoard(row);
}

export async function deleteBoard(boardId: string) {
    const { error } = await supabase.from("boards").delete().eq("id", boardId);
    if (error) throw error;
}

export async function fetchBoard(boardId: string): Promise<ProjectBoardRecord> {
    const { data, error } = await supabase
        .from("boards")
        .select(
            "id, project_id, name, position, base_branch, allowed_head_patterns"
        )
        .eq("id", boardId)
        .single();

    if (error) throw error;
    return mapDatabaseBoard(data as DatabaseBoard);
}

export async function fetchProjectBoards(
    projectId: string
): Promise<ProjectBoardRecord[]> {
    const { data, error } = await supabase
        .from("boards")
        .select(
            "id, project_id, name, position, base_branch, allowed_head_patterns"
        )
        .eq("project_id", projectId)
        .order("position", { ascending: true });

    if (error) throw error;
    return (data as DatabaseBoard[]).map((row) => mapDatabaseBoard(row));
}

export async function updateBoard(
    boardId: string,
    patch: {
        allowed_head_patterns?: string[];
        base_branch?: string;
        name?: string;
        position?: number;
    }
) {
    const { data, error } = await supabase
        .from("boards")
        .update(patch)
        .eq("id", boardId)
        .select(
            "id, project_id, name, position, base_branch, allowed_head_patterns"
        )
        .single();

    if (error) throw error;
    return mapDatabaseBoard(data as DatabaseBoard);
}

function mapDatabaseBoard(row: DatabaseBoard): ProjectBoardRecord {
    return {
        allowedHeadPatterns: row.allowed_head_patterns ?? [],
        baseBranch: row.base_branch,
        id: row.id,
        name: row.name,
        position: row.position,
        projectId: row.project_id,
    };
}
