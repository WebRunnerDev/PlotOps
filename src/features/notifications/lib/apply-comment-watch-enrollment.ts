export type ApplyCommentWatchEnrollmentInput = {
    action: "create" | "edit";
    commenterId: string;
    watcherIds: readonly string[];
};

/**
 * Sticky Watch enrollment on Comment create (ADR 0028 / 0029).
 * Creating a Comment auto-enrolls the commenter (explicit re-subscribe after
 * Unwatch). Editing a Comment does not enroll.
 */
export function applyCommentWatchEnrollment(
    input: ApplyCommentWatchEnrollmentInput
): string[] {
    if (input.action !== "create") {
        return [...input.watcherIds];
    }

    const watchers = new Set(input.watcherIds);
    watchers.add(input.commenterId);
    return [...watchers];
}
