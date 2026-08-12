export type ResolveBoardNewTaskCtaVisibleInput = {
    canCreateTasks: boolean;
    isSettled: boolean;
};

/** Board chrome + New Task is Manager+ only once project access has settled. */
export function resolveBoardNewTaskCtaVisible(
    input: ResolveBoardNewTaskCtaVisibleInput
): boolean {
    return input.isSettled && input.canCreateTasks;
}
