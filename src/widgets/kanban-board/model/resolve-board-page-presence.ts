export type BoardPagePresence =
    | { currentBoard: BoardPagePresenceBoard; kind: "ready" }
    | { kind: "board-not-found" }
    | { kind: "boards-error" }
    | { kind: "boards-loading" }
    | { kind: "project-error" }
    | { kind: "project-loading" };

export type BoardPagePresenceBoard = {
    baseBranch: string;
    id: string;
};

export type ResolveBoardPagePresenceInput = {
    boardId: string;
    boards: readonly BoardPagePresenceBoard[];
    boardsError: boolean;
    boardsLoading: boolean;
    project: null | undefined | { id: string };
    projectError: boolean;
    projectLoading: boolean;
};

/**
 * Gates BoardPage chrome + KanbanBoard until project and boardId are verified.
 * Refetch failures that leave prior cache intact must not unmount the board.
 */
export function resolveBoardPagePresence(
    input: ResolveBoardPagePresenceInput
): BoardPagePresence {
    if (input.projectLoading) {
        return { kind: "project-loading" };
    }

    // `projectError` alone is not fatal when cache still has the project
    // (TanStack Query keeps data on refetch failure).
    if (!input.project) {
        return { kind: "project-error" };
    }

    if (input.boardsLoading && input.boards.length === 0) {
        return { kind: "boards-loading" };
    }

    if (input.boardsError && input.boards.length === 0) {
        return { kind: "boards-error" };
    }

    const currentBoard = input.boards.find(
        (board) => board.id === input.boardId
    );
    if (!currentBoard) {
        if (input.boardsLoading) {
            return { kind: "boards-loading" };
        }
        return { kind: "board-not-found" };
    }

    return { currentBoard, kind: "ready" };
}
