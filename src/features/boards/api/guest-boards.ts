import type { BoardsProvider } from "@/features/boards/api/boards-provider";
import type {
    BoardColumn,
    ProjectBoardRecord,
} from "@/features/boards/model/types";
import type { GuestBoard } from "@/features/guest-mode";

import { getGuestSandbox } from "@/features/guest-mode";

function mapBoard(board: GuestBoard): ProjectBoardRecord {
    return {
        allowedHeadPatterns: [...board.allowedHeadPatterns],
        baseBranch: board.baseBranch,
        id: board.id,
        name: board.name,
        position: board.position,
        projectId: board.projectId,
    };
}

function requireBoard(boardId: string): GuestBoard {
    const sandbox = getGuestSandbox();
    if (!sandbox) {
        throw new Error("No Guest Session");
    }
    const board = sandbox.boards.find((item) => item.id === boardId);
    if (!board) {
        throw new Error("Board not found");
    }
    return board;
}

/** Guest Mode Boards adapter — reads the local sandbox; never calls Supabase. */
export const guestBoardsProvider: BoardsProvider = {
    async boardHasTasks(boardId) {
        const sandbox = getGuestSandbox();
        if (!sandbox) {
            throw new Error("No Guest Session");
        }
        return sandbox.tasks.some((task) => task.boardId === boardId);
    },

    async fetchBoard(boardId) {
        return mapBoard(requireBoard(boardId));
    },

    async fetchBoardColumnIds(boardId) {
        return requireBoard(boardId).columns.map((column) => column.id);
    },

    async fetchBoardColumns(_projectId, boardId) {
        const columns = [...requireBoard(boardId).columns].toSorted(
            (a, b) => a.position - b.position
        );
        return columns.map((column): BoardColumn => ({
            id: column.id,
            name: column.name,
        }));
    },

    async fetchBoardColumnSummaries(boardId) {
        return guestBoardsProvider.fetchBoardColumns("", boardId);
    },

    async fetchProjectBoards(projectId) {
        const sandbox = getGuestSandbox();
        if (!sandbox) {
            throw new Error("No Guest Session");
        }
        return [...sandbox.boards]
            .filter((board) => board.projectId === projectId)
            .toSorted((a, b) => a.position - b.position)
            .map((board) => mapBoard(board));
    },
};
