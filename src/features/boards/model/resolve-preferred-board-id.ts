/**
 * Picks a Board for Project entry / Switch Project.
 * Prefer the remembered id when it still exists; otherwise the first Board.
 */
export function resolvePreferredBoardId(
    boards: readonly { id: string }[],
    rememberedBoardId?: null | string
): string | undefined {
    if (
        rememberedBoardId &&
        boards.some((board) => board.id === rememberedBoardId)
    ) {
        return rememberedBoardId;
    }
    return boards[0]?.id;
}
