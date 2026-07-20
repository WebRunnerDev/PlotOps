import { DEFAULT_KANBAN_COLUMNS } from "@/features/tasks/model/constants";
import { supabase } from "@/shared/api/supabase";

export type ProjectBoardRecord = {
    allowedHeadPatterns: string[];
    baseBranch: string;
    id: string;
    name: string;
    position: number;
    projectId: string;
};

type DbBoard = {
    allowed_head_patterns: string[] | null;
    base_branch: string;
    id: string;
    name: string;
    position: number;
    project_id: string;
};

function mapDbBoard(row: DbBoard): ProjectBoardRecord {
    return {
        allowedHeadPatterns: row.allowed_head_patterns ?? [],
        baseBranch: row.base_branch,
        id: row.id,
        name: row.name,
        position: row.position,
        projectId: row.project_id,
    };
}

export async function fetchProjectBoards(
    projectId: string,
): Promise<ProjectBoardRecord[]> {
    const { data, error } = await supabase
        .from("boards")
        .select(
            "id, project_id, name, position, base_branch, allowed_head_patterns",
        )
        .eq("project_id", projectId)
        .order("position", { ascending: true });

    if (error) throw error;
    return (data as DbBoard[]).map(mapDbBoard);
}

export async function fetchBoard(
    boardId: string,
): Promise<ProjectBoardRecord> {
    const { data, error } = await supabase
        .from("boards")
        .select(
            "id, project_id, name, position, base_branch, allowed_head_patterns",
        )
        .eq("id", boardId)
        .single();

    if (error) throw error;
    return mapDbBoard(data as DbBoard);
}

export async function createBoard(
    projectId: string,
    name: string,
    baseBranch: string,
) {
    const { data: existing, error: existingError } = await supabase
        .from("boards")
        .select("position")
        .eq("project_id", projectId)
        .order("position", { ascending: false })
        .limit(1);

    if (existingError) throw existingError;

    const position = (existing?.[0]?.position ?? -1) + 1;

    const { data, error } = await supabase
        .from("boards")
        .insert({
            base_branch: baseBranch || "main",
            name: name.trim() || "Board",
            position,
            project_id: projectId,
        })
        .select(
            "id, project_id, name, position, base_branch, allowed_head_patterns",
        )
        .single();

    if (error) throw error;

    const board = mapDbBoard(data as DbBoard);

    const columns = DEFAULT_KANBAN_COLUMNS.map((column, index) => ({
        board_id: board.id,
        id: column.id,
        name: column.name,
        position: index,
        project_id: projectId,
    }));

    const { error: columnsError } = await supabase
        .from("board_columns")
        .insert(columns);

    if (columnsError) throw columnsError;

    return board;
}

export async function updateBoard(
    boardId: string,
    patch: {
        allowed_head_patterns?: string[];
        base_branch?: string;
        name?: string;
        position?: number;
    },
) {
    const { data, error } = await supabase
        .from("boards")
        .update(patch)
        .eq("id", boardId)
        .select(
            "id, project_id, name, position, base_branch, allowed_head_patterns",
        )
        .single();

    if (error) throw error;
    return mapDbBoard(data as DbBoard);
}

export async function deleteBoard(boardId: string) {
    const { error } = await supabase.from("boards").delete().eq("id", boardId);
    if (error) throw error;
}

export async function boardHasTasks(boardId: string): Promise<boolean> {
    const { count, error } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("board_id", boardId);

    if (error) throw error;
    return (count ?? 0) > 0;
}

export async function fetchBoardColumns(
    boardId: string,
): Promise<Array<{ id: string; name: string }>> {
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

export async function fetchBoardColumnIds(boardId: string): Promise<string[]> {
    const columns = await fetchBoardColumns(boardId);
    return columns.map((column) => column.id);
}
