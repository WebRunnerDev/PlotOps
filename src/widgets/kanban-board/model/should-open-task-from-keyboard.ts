export type TaskOpenKeyboardEvent = {
    key: string;
};

/**
 * Primary open activation for task cards (Enter / Space), ignoring drag.
 */
export function shouldOpenTaskFromKeyboard(
    event: TaskOpenKeyboardEvent,
    isDragging: boolean
): boolean {
    if (isDragging) {
        return false;
    }

    return event.key === "Enter" || event.key === " ";
}
