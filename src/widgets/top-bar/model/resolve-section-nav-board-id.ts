export type BoardsQueryStatus = "error" | "pending" | "success";

export type ResolveSectionNavBoardIdInput = {
    boardIdFromRoute?: string;
    boards: readonly { id: string }[];
    rememberedBoardId?: string;
    status: BoardsQueryStatus;
};

/**
 * Resolves which board id section-nav Board/Backlog links may use.
 * Settings/CI/CD never depend on this — callers must always render those.
 *
 * Pending: allow route/remembered candidate (optimistic).
 * Error: omit Board/Backlog until boards can be validated.
 * Success: candidate if still in list, else first board.
 */
export function resolveSectionNavBoardId(
    input: ResolveSectionNavBoardIdInput
): string | undefined {
    const candidate = input.boardIdFromRoute ?? input.rememberedBoardId;

    if (input.status === "pending") {
        return candidate;
    }

    if (input.status === "error") {
        return undefined;
    }

    if (candidate && input.boards.some((board) => board.id === candidate)) {
        return candidate;
    }

    return input.boards[0]?.id;
}
