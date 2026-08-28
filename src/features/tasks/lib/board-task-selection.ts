export function isBoardMultiSelectModifier(event: {
    ctrlKey: boolean;
    metaKey: boolean;
}): boolean {
    return event.metaKey || event.ctrlKey;
}

/**
 * Inclusive range between anchor and target in column order.
 * When anchor is missing or not in the column, returns only the target.
 */
export function resolveColumnSelectionRange(
    columnTaskIds: readonly string[],
    anchorId: null | string,
    targetId: string
): string[] {
    const targetIndex = columnTaskIds.indexOf(targetId);
    if (targetIndex === -1) {
        return [targetId];
    }

    if (anchorId === null) {
        return [targetId];
    }

    const anchorIndex = columnTaskIds.indexOf(anchorId);
    if (anchorIndex === -1) {
        return [targetId];
    }

    const start = Math.min(anchorIndex, targetIndex);
    const end = Math.max(anchorIndex, targetIndex);
    return columnTaskIds.slice(start, end + 1);
}

/** Block native text selection while bulk-selecting board tasks. */
export function shouldPreventBoardTaskTextSelection(input: {
    ctrlKey: boolean;
    metaKey: boolean;
    selectionActive: boolean;
    selectionEnabled: boolean;
    shiftKey: boolean;
}): boolean {
    if (!input.selectionEnabled) {
        return false;
    }
    if (input.selectionActive) {
        return true;
    }
    return (
        input.shiftKey ||
        isBoardMultiSelectModifier({
            ctrlKey: input.ctrlKey,
            metaKey: input.metaKey,
        })
    );
}
