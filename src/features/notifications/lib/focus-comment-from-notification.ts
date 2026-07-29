import type {
    MentionMetadata,
    Notification,
} from "@/features/notifications/model/types";

/** Comment id to focus when opening a Comment Mention Notification. */
export function focusCommentIdFromNotification(
    notification: Notification
): string | undefined {
    if (notification.kind !== "mention") {
        return undefined;
    }

    const metadata = notification.metadata as MentionMetadata;
    if (metadata.source !== "comment") {
        return undefined;
    }

    const commentId = metadata.commentId;
    return typeof commentId === "string" && commentId.length > 0
        ? commentId
        : undefined;
}
