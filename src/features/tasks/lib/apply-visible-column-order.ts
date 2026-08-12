import { arrayMove } from "@dnd-kit/sortable";

/**
 * Rebuild a column after reordering or inserting only the visible cards.
 * Hidden siblings keep their original slots; extra visible ids append at the end.
 */
export function applyVisibleColumnOrder<T extends { id: string }>(
    columnTasks: readonly T[],
    visibleIdsInOrder: readonly string[]
): T[] {
    const byId = new Map(columnTasks.map((task) => [task.id, task]));
    const visibleSet = new Set(visibleIdsInOrder);
    const queue = [...visibleIdsInOrder];
    const next: T[] = [];

    for (const task of columnTasks) {
        if (!visibleSet.has(task.id)) {
            next.push(task);
            continue;
        }

        const nextId = queue.shift();
        if (!nextId) continue;
        const resolved = byId.get(nextId);
        if (resolved) next.push(resolved);
    }

    for (const id of queue) {
        const resolved = byId.get(id);
        if (resolved) next.push(resolved);
    }

    return next;
}

export function reorderVisibleColumnSubset<T extends { id: string }>(
    columnTasks: readonly T[],
    visibleIdsInOrder: readonly string[],
    activeId: string,
    overId: string
): T[] | undefined {
    const from = visibleIdsInOrder.indexOf(activeId);
    const to = visibleIdsInOrder.indexOf(overId);
    if (from === -1 || to === -1 || from === to) return undefined;

    const nextVisible = arrayMove([...visibleIdsInOrder], from, to);
    return applyVisibleColumnOrder(columnTasks, nextVisible);
}
