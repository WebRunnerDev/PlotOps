import type { MentionSource } from "@/features/notifications/model/types";

export type MentionFanOutRequest = {
    actorName: string;
    commentId: null | string;
    mentioneeIds: string[];
    source: MentionSource;
    taskId: string;
};

/**
 * Call-site seam for `create_notifications_for_mentions`.
 * Membership validation, actor exclusion, and Mentionee dedupe happen in the RPC.
 */
export function buildMentionFanOutRequest(input: {
    actorName: string;
    commentId?: null | string;
    mentioneeIds: readonly string[];
    source: MentionSource;
    taskId: string;
}): MentionFanOutRequest | undefined {
    if (input.mentioneeIds.length === 0) {
        return undefined;
    }

    return {
        actorName: input.actorName,
        commentId:
            input.source === "comment" ? (input.commentId ?? null) : null,
        mentioneeIds: [...input.mentioneeIds],
        source: input.source,
        taskId: input.taskId,
    };
}
