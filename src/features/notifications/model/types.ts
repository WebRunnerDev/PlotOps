/** Watcher kind metadata — same shape as always-on assignment. */
export type AssigneeChangeMetadata = AssignmentMetadata;

export type AssignmentMetadata = {
    assignee: { id: string; name: string };
    previousAssignee?: null | { id: string; name: string };
    source?: "app" | "github_webhook";
};

export type AuthorChangeMetadata = {
    author: { id: string; name: string };
    previousAuthor?: null | { id: string; name: string };
    source?: "app" | "github_webhook";
};

export type BoardMoveMetadata = {
    fromBoard: { id: string; name: string };
    fromStatus?: null | { id: string; name: string };
    source?: "app" | "github_webhook";
    toBoard: { id: string; name: string };
    toStatus?: null | { id: string; name: string };
};

export type Notification = {
    createdAt: string;
    id: string;
    kind: NotificationKind;
    metadata: NotificationMetadata;
    projectId: string;
    readAt: null | string;
    taskId: string;
    taskKey: string;
    taskTitle: string;
};

/** Closed structural set — do not invent kinds beyond this list. Mentions out of scope. */
export type NotificationKind =
    | "assignee_change"
    | "assignment"
    | "author_change"
    | "board_move"
    | "priority_change"
    | "status_change";

export type NotificationMetadata =
    | AssigneeChangeMetadata
    | AssignmentMetadata
    | AuthorChangeMetadata
    | BoardMoveMetadata
    | PriorityChangeMetadata
    | Record<string, unknown>
    | StatusChangeMetadata;

export type PriorityChangeMetadata = {
    from: string;
    source?: "app" | "github_webhook";
    to: string;
};

export type StatusChangeMetadata = {
    from: { id: string; name: string };
    source?: "app" | "github_webhook";
    to: { id: string; name: string };
};

export type TaskWatcher = {
    avatarUrl: null | string;
    name: string;
    userId: string;
};
