/**
 * Effective Active-Sprint filter for Kanban. `selectedIds === null` means
 * “all Actives” (default; not persisted across reload). Stale ids drop out;
 * if nothing remains, fall back to all current Actives.
 */
export function resolveActiveSprintFilterIds(input: {
    activeSprintIds: readonly string[];
    selectedIds: null | readonly string[];
}): string[] {
    if (input.activeSprintIds.length === 0) return [];
    if (input.selectedIds === null || input.selectedIds.length === 0) {
        return [...input.activeSprintIds];
    }
    const activeSet = new Set(input.activeSprintIds);
    const kept = input.selectedIds.filter((id) => activeSet.has(id));
    if (kept.length === 0) return [...input.activeSprintIds];
    return kept;
}

/**
 * Toggle one Active chip. Refuses to clear the last remaining selection.
 */
export function toggleActiveSprintFilterId(input: {
    selectedIds: readonly string[];
    toggleId: string;
}): string[] {
    if (input.selectedIds.includes(input.toggleId)) {
        if (input.selectedIds.length <= 1) return [...input.selectedIds];
        return input.selectedIds.filter((id) => id !== input.toggleId);
    }
    return [...input.selectedIds, input.toggleId];
}
