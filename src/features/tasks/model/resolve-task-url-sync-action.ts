export type TaskUrlSyncAction =
    | { taskId: string; type: "select-from-url" }
    | { taskRef: string; type: "push-url" }
    | { type: "clear-selection" }
    | { type: "noop" }
    | { type: "strip-url" };

export type TaskUrlSyncState = {
    hadUrlTask: string | undefined;
    selectedTaskId: string | undefined;
    selectedTaskKey: string | undefined;
    urlTaskId: string | undefined;
    urlTaskRef: string | undefined;
    wasSelected: boolean;
};

/** Pure sync rules for `?task=` ↔ drawer selection. */
export function resolveTaskUrlSyncAction(
    state: TaskUrlSyncState
): TaskUrlSyncAction {
    const {
        hadUrlTask,
        selectedTaskId,
        selectedTaskKey,
        urlTaskId,
        urlTaskRef,
        wasSelected,
    } = state;

    if (urlTaskRef && !urlTaskId) {
        return { type: "noop" };
    }

    if (!selectedTaskId && urlTaskId) {
        if (wasSelected) {
            return { type: "strip-url" };
        }
        return { taskId: urlTaskId, type: "select-from-url" };
    }

    if (urlTaskId && urlTaskId !== selectedTaskId) {
        // URL changed (back/forward, shared link) → follow the query.
        // Selection changed while ?task= is stale (Subtask/link click) → push.
        if (urlTaskRef !== hadUrlTask) {
            return { taskId: urlTaskId, type: "select-from-url" };
        }
        return {
            taskRef: selectedTaskKey ?? selectedTaskId,
            type: "push-url",
        };
    }

    if (hadUrlTask && !urlTaskRef && selectedTaskId) {
        return { type: "clear-selection" };
    }

    if (
        selectedTaskId &&
        selectedTaskKey &&
        urlTaskId === selectedTaskId &&
        urlTaskRef !== selectedTaskKey
    ) {
        return { taskRef: selectedTaskKey, type: "push-url" };
    }

    if (selectedTaskId && urlTaskId !== selectedTaskId) {
        return {
            taskRef: selectedTaskKey ?? selectedTaskId,
            type: "push-url",
        };
    }

    return { type: "noop" };
}
