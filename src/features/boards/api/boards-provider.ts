import type {
    BoardColumn,
    ProjectBoardRecord,
} from "@/features/boards/model/types";

/**
 * Narrow Boards (+ columns) data seam for Guest vs Supabase resolution.
 * Happy-path board navigation + column reads for kanban; settings mutations
 * stay on call sites that are inert/hidden in Guest Mode.
 */
export type BoardsProvider = {
    boardHasTasks(boardId: string): Promise<boolean>;
    fetchBoard(boardId: string): Promise<ProjectBoardRecord>;
    fetchBoardColumnIds(boardId: string): Promise<string[]>;
    fetchBoardColumns(
        projectId: string,
        boardId: string
    ): Promise<BoardColumn[]>;
    fetchBoardColumnSummaries(boardId: string): Promise<BoardColumn[]>;
    fetchProjectBoards(projectId: string): Promise<ProjectBoardRecord[]>;
};
