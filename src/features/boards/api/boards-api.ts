import type {
    BoardDefaultTaskType,
    BoardMergeTargetMode,
    CreateBoardInput,
    ProjectBoardRecord,
    UpdateBoardPatch,
} from "@/features/boards/model/types";

import { normalizeBoardDevelopmentPatch } from "@/features/boards/lib/normalize-board-development-patch";
import { supabase } from "@/shared/api/supabase";

type DatabaseBoard = {
    allowed_head_patterns: null | string[];
    auto_assign_to_creator: boolean | null;
    board_repositories?:
        | null
        | {
              base_branch: string;
              repository: null | { created_at: string };
              repository_id: string;
          }[];
    default_task_type: null | string;
    id: string;
    is_development: boolean;
    merge_target_column_id: null | string;
    merge_target_mode: null | string;
    name: string;
    position: number;
    project_id: string;
};

const BOARD_SELECT =
    "id, project_id, name, position, allowed_head_patterns, default_task_type, auto_assign_to_creator, is_development, merge_target_mode, merge_target_column_id, board_repositories (repository_id, base_branch, repository:project_repositories (created_at))";

const MERGE_TARGET_MODES = new Set<string>(["column", "last_column", "none"]);

const TASK_TYPES = new Set<string>(["bug", "story", "task"]);

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
    input: CreateBoardInput
) {
    const isDevelopment = input.isDevelopment;
    const baseBranch = isDevelopment ? input.baseBranch?.trim() || null : null;

    const { data, error } = await supabase.rpc("create_board_with_columns", {
        p_base_branch: baseBranch,
        p_is_development: isDevelopment,
        p_name: name.trim() || "Board",
        p_project_id: projectId,
    });

    if (error) throw error;

    const row = data as null | { id: string };
    if (!row) {
        throw new Error("create_board_with_columns returned no board");
    }

    return fetchBoard(row.id);
}

export async function deleteBoard(boardId: string) {
    const { error } = await supabase.from("boards").delete().eq("id", boardId);
    if (error) throw error;
}

export async function fetchBoard(boardId: string): Promise<ProjectBoardRecord> {
    const { data, error } = await supabase
        .from("boards")
        .select(BOARD_SELECT)
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
        .select(BOARD_SELECT)
        .eq("project_id", projectId)
        .order("position", { ascending: true });

    if (error) throw error;
    return (data as DatabaseBoard[]).map((row) => mapDatabaseBoard(row));
}

export async function updateBoard(boardId: string, patch: UpdateBoardPatch) {
    const { base_branch: baseBranch, ...boardPatch } = {
        ...patch,
        ...normalizeBoardDevelopmentPatch(patch),
    };

    const { error } = await supabase
        .from("boards")
        .update(boardPatch)
        .eq("id", boardId);

    if (error) throw error;

    // Rows exist only on a Development Board (seeded by trigger on enable).
    if (baseBranch) {
        const { error: baseError } = await supabase
            .from("board_repositories")
            .update({ base_branch: baseBranch })
            .eq("board_id", boardId);

        if (baseError) throw baseError;
    }

    return fetchBoard(boardId);
}

function mapDatabaseBoard(row: DatabaseBoard): ProjectBoardRecord {
    // Repository order (oldest first) matches Project.repositories.
    const repositoryBaseBranches = (row.board_repositories ?? [])
        .toSorted(
            (a, b) =>
                Date.parse(a.repository?.created_at ?? "") -
                    Date.parse(b.repository?.created_at ?? "") ||
                a.repository_id.localeCompare(b.repository_id)
        )
        .map((item) => ({
            baseBranch: item.base_branch,
            repositoryId: item.repository_id,
        }));

    return {
        allowedHeadPatterns: row.allowed_head_patterns ?? [],
        autoAssignToCreator: row.auto_assign_to_creator === true,
        baseBranch: repositoryBaseBranches[0]?.baseBranch ?? null,
        defaultTaskType: toDefaultTaskType(row.default_task_type),
        id: row.id,
        isDevelopment: row.is_development,
        ...toMergeTarget(row.merge_target_mode, row.merge_target_column_id),
        name: row.name,
        position: row.position,
        projectId: row.project_id,
        repositoryBaseBranches,
    };
}

function toDefaultTaskType(
    value: null | string | undefined
): BoardDefaultTaskType {
    if (!value || !TASK_TYPES.has(value)) return "task";
    return value as BoardDefaultTaskType;
}

function toMergeTarget(
    mode: null | string,
    columnId: null | string
): Pick<ProjectBoardRecord, "mergeTargetColumnId" | "mergeTargetMode"> {
    if (!mode || !MERGE_TARGET_MODES.has(mode)) {
        return { mergeTargetColumnId: null, mergeTargetMode: "last_column" };
    }
    return {
        mergeTargetColumnId: mode === "column" ? columnId : null,
        mergeTargetMode: mode as BoardMergeTargetMode,
    };
}
