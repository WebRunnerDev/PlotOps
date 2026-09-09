export type ApplyStakeWatchEnrollmentInput = {
    next: StakePersonIds;
    previous: StakePersonIds;
    watcherIds: readonly string[];
};

export type StakePersonIds = {
    assigneeId: null | string;
    authorId: null | string;
};

/**
 * Sticky Watch enrollment on Author/Assignee stake changes (ADR 0028).
 * Auto-enrolls when Author/Assignee is set; never removes Watch on stake loss.
 */
export function applyStakeWatchEnrollment(
    input: ApplyStakeWatchEnrollmentInput
): string[] {
    const watchers = new Set(input.watcherIds);

    if (
        input.next.authorId != undefined &&
        input.previous.authorId !== input.next.authorId
    ) {
        watchers.add(input.next.authorId);
    }

    if (
        input.next.assigneeId != undefined &&
        input.previous.assigneeId !== input.next.assigneeId
    ) {
        watchers.add(input.next.assigneeId);
    }

    return [...watchers];
}
