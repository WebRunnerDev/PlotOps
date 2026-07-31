/**
 * Ignore the synthetic click that follows a completed drag gesture.
 */
export function shouldOpenTaskFromPointer(
    isDragging: boolean,
    suppressOpenAfterDrag: boolean
): boolean {
    if (isDragging || suppressOpenAfterDrag) {
        return false;
    }
    return true;
}
