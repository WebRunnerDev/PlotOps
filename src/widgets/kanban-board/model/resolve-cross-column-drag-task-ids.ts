/**
 * When the dragged card is part of a multi-selection, cross-column previews
 * move the whole selection. Dragging an unselected card moves only that card.
 */
export function resolveCrossColumnDragTaskIds(input: {
    activeId: string;
    selectedIds: ReadonlySet<string>;
}): string[] {
    const { activeId, selectedIds } = input;
    if (selectedIds.has(activeId) && selectedIds.size > 1) {
        return [...selectedIds];
    }
    return [activeId];
}
