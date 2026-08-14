import type { TFunction } from "i18next";

import type {
    AssigneeChangeMetadata,
    AuthorChangeMetadata,
    BoardMoveMetadata,
    DeadlineChangeMetadata,
    MentionMetadata,
    Notification,
    PriorityChangeMetadata,
    StatusChangeMetadata,
    SubtaskChangeMetadata,
} from "@/features/notifications/model/types";

export function formatNotificationContext(
    notification: Notification,
    t: TFunction<"common">
): string {
    if (notification.kind === "assignment") {
        // Recipient-facing copy — ignore assignee.name (viewer is the assignee).
        return t("notifications.kinds.assignment");
    }

    if (notification.kind === "assignee_change") {
        const metadata = notification.metadata as AssigneeChangeMetadata;
        if (metadata.audience === "previous_assignee") {
            // Recipient-facing copy — viewer is the previous Assignee.
            return t("notifications.kinds.assigneeRemoved");
        }
        const to = metadata.assignee?.name;
        const from = metadata.previousAssignee?.name;
        if (from && to) {
            return t("notifications.kinds.assigneeChangeFromDetail", {
                from,
                to,
            });
        }
        if (to) {
            return t("notifications.kinds.assigneeChangeDetail", { name: to });
        }
        return t("notifications.kinds.assigneeChange");
    }

    if (notification.kind === "author_change") {
        const metadata = notification.metadata as AuthorChangeMetadata;
        const to = metadata.author?.name;
        const from = metadata.previousAuthor?.name;
        if (from && to) {
            return t("notifications.kinds.authorChangeFromDetail", {
                from,
                to,
            });
        }
        if (to) {
            return t("notifications.kinds.authorChangeDetail", { name: to });
        }
        return t("notifications.kinds.authorChange");
    }

    if (notification.kind === "board_move") {
        const metadata = notification.metadata as BoardMoveMetadata;
        const fromBoard = metadata.fromBoard?.name;
        const toBoard = metadata.toBoard?.name;
        const fromStatus = metadata.fromStatus?.name;
        const toStatus = metadata.toStatus?.name;
        if (fromBoard && toBoard && fromStatus && toStatus) {
            return t("notifications.kinds.boardMoveStatusDetail", {
                fromBoard,
                fromStatus,
                toBoard,
                toStatus,
            });
        }
        if (fromBoard && toBoard) {
            return t("notifications.kinds.boardMoveDetail", {
                fromBoard,
                toBoard,
            });
        }
        return t("notifications.kinds.boardMove");
    }

    if (notification.kind === "deadline_change") {
        const metadata = notification.metadata as DeadlineChangeMetadata;
        const from = metadata.from;
        const to = metadata.to;
        if (from && to) {
            return t("notifications.kinds.deadlineChangeDetail", { from, to });
        }
        if (to && !from) {
            return t("notifications.kinds.deadlineChangeSetDetail", { to });
        }
        if (from && !to) {
            return t("notifications.kinds.deadlineChangeClearedDetail", {
                from,
            });
        }
        return t("notifications.kinds.deadlineChange");
    }

    if (notification.kind === "mention") {
        const metadata = notification.metadata as MentionMetadata;
        const name = metadata.actor?.name;
        if (name && metadata.source === "comment") {
            return t("notifications.kinds.mentionCommentDetail", { name });
        }
        if (name && metadata.source === "description") {
            return t("notifications.kinds.mentionDescriptionDetail", { name });
        }
        if (metadata.source === "comment") {
            return t("notifications.kinds.mentionComment");
        }
        if (metadata.source === "description") {
            return t("notifications.kinds.mentionDescription");
        }
        return t("notifications.kinds.mention");
    }

    if (notification.kind === "subtask_change") {
        const metadata = notification.metadata as SubtaskChangeMetadata;
        const key = metadata.subtaskKey;
        if (key && metadata.action === "created") {
            return t("notifications.kinds.subtaskChangeCreatedDetail", { key });
        }
        if (key && metadata.action === "closed") {
            return t("notifications.kinds.subtaskChangeClosedDetail", { key });
        }
        return t("notifications.kinds.subtaskChange");
    }

    if (notification.kind === "priority_change") {
        const metadata = notification.metadata as PriorityChangeMetadata;
        const from = priorityLabel(metadata.from, t);
        const to = priorityLabel(metadata.to, t);
        if (from && to) {
            return t("notifications.kinds.priorityChangeDetail", { from, to });
        }
        return t("notifications.kinds.priorityChange");
    }

    const metadata = notification.metadata as StatusChangeMetadata;
    const from = metadata.from?.name;
    const to = metadata.to?.name;
    if (from && to) {
        return t("notifications.kinds.statusChangeDetail", { from, to });
    }
    return t("notifications.kinds.statusChange");
}

function priorityLabel(
    value: string | undefined,
    t: TFunction<"common">
): string | undefined {
    if (!value) return undefined;
    const key =
        `notifications.priority.${value}` as `notifications.priority.${string}`;
    const label = t(key);
    return label === key ? value : label;
}
