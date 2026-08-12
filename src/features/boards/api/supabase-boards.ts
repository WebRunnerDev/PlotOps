import type { BoardsProvider } from "@/features/boards/api/boards-provider";

import {
    createBoardColumn,
    deleteBoardColumn,
    fetchBoardColumnIds,
    fetchBoardColumns,
    fetchBoardColumnSummaries,
    renameBoardColumn,
    reorderBoardColumns,
    setBoardDoneColumn,
} from "@/features/boards/api/board-columns-api";
import {
    boardHasTasks,
    createBoard,
    deleteBoard,
    fetchBoard,
    fetchProjectBoards,
    updateBoard,
} from "@/features/boards/api/boards-api";

/** Real-account Boards adapter — delegates to existing Supabase APIs. */
export const supabaseBoardsProvider: BoardsProvider = {
    boardHasTasks,
    createBoard,
    createBoardColumn,
    deleteBoard,
    deleteBoardColumn,
    fetchBoard,
    fetchBoardColumnIds,
    fetchBoardColumns,
    fetchBoardColumnSummaries,
    fetchProjectBoards,
    renameBoardColumn,
    reorderBoardColumns,
    setBoardDoneColumn,
    updateBoard,
};
