import type {
    BoardColumn,
    ProjectBoardRecord,
} from "@/features/boards/model/types";

/**
 * Boards (+ columns) data seam for Guest vs Supabase resolution.
 * Happy-path reads and settings mutations that run against the local sandbox
 * in Guest Mode.
 */
export type BoardsProvider = {
    boardHasTasks(boardId: string): Promise<boolean>;
    createBoard(
        projectId: string,
        name: string,
        baseBranch: string
    ): Promise<ProjectBoardRecord>;
    createBoardColumn(
        projectId: string,
        boardId: string,
        name: string
    ): Promise<string>;
    deleteBoard(boardId: string): Promise<void>;
    deleteBoardColumn(
        boardId: string,
        columnId: string,
        moveTasksTo?: string
    ): Promise<void>;
    fetchBoard(boardId: string): Promise<ProjectBoardRecord>;
    fetchBoardColumnIds(boardId: string): Promise<string[]>;
    fetchBoardColumns(
        projectId: string,
        boardId: string
    ): Promise<BoardColumn[]>;
    fetchBoardColumnSummaries(boardId: string): Promise<BoardColumn[]>;
    fetchProjectBoards(projectId: string): Promise<ProjectBoardRecord[]>;
    renameBoardColumn(
        boardId: string,
        columnId: string,
        name: string
    ): Promise<void>;
    reorderBoardColumns(boardId: string, columnIds: string[]): Promise<void>;
    /** Marks `columnId` as Done (≤1 per board); `null` clears Done. */
    setBoardDoneColumn(boardId: string, columnId: null | string): Promise<void>;
    updateBoard(
        boardId: string,
        patch: {
            allowed_head_patterns?: string[];
            base_branch?: string;
            default_task_type?: ProjectBoardRecord["defaultTaskType"];
            name?: string;
            position?: number;
        }
    ): Promise<ProjectBoardRecord>;
};
