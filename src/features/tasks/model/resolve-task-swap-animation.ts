export type TaskSwapAnimation = {
    direction: TaskSwapDirection;
    shouldAnimate: boolean;
};

export type TaskSwapDirection = "back" | "forward";

/** Parent→Subtask slides forward; Subtask→Parent slides back; else forward. */
export function resolveTaskSwapAnimation(input: {
    currentId: string | undefined;
    currentParentId: string | undefined;
    previousId: string | undefined;
    previousParentId: string | undefined;
}): TaskSwapAnimation {
    const { currentId, currentParentId, previousId, previousParentId } = input;

    if (!currentId || !previousId || previousId === currentId) {
        return { direction: "forward", shouldAnimate: false };
    }

    const direction: TaskSwapDirection =
        currentParentId === previousId
            ? "forward"
            : previousParentId === currentId
              ? "back"
              : "forward";

    return { direction, shouldAnimate: true };
}
