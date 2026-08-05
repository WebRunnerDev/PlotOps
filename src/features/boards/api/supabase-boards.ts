import type { BoardsProvider } from "@/features/boards/api/boards-provider";

import {
    fetchBoardColumnIds,
    fetchBoardColumns,
    fetchBoardColumnSummaries,
} from "@/features/boards/api/board-columns-api";
import {
    boardHasTasks,
    fetchBoard,
    fetchProjectBoards,
} from "@/features/boards/api/boards-api";

/** Real-account Boards adapter — delegates to existing Supabase APIs. */
export const supabaseBoardsProvider: BoardsProvider = {
    boardHasTasks,
    fetchBoard,
    fetchBoardColumnIds,
    fetchBoardColumns,
    fetchBoardColumnSummaries,
    fetchProjectBoards,
};
