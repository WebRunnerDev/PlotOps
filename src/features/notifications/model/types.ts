/** Watcher / always-on previous-Assignee metadata. */
export type AssigneeChangeMetadata = AssignmentMetadata & {
    /** Always-on row for the previous Assignee (not Watcher fan-out). */
    audience?: "previous_assignee";
};

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

export type DeadlineChangeMetadata = {
    from: null | string;
    source?: "app" | "github_webhook";
    to: null | string;
};

/** Always-on Mention — source is Description vs Comment (not app/webhook). */
export type MentionMetadata = {
    actor: { id: string; name: string };
    commentId?: string;
    source: MentionSource;
};

export type MentionSource = "comment" | "description";

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

/** Closed structural set — do not invent kinds beyond this list. */
export type NotificationKind =
    | "assignee_change"
    | "assignment"
    | "author_change"
    | "board_move"
    | "deadline_change"
    | "mention"
    | "priority_change"
    | "status_change"
    | "subtask_change";

export type NotificationMetadata =
    | AssigneeChangeMetadata
    | AssignmentMetadata
    | AuthorChangeMetadata
    | BoardMoveMetadata
    | DeadlineChangeMetadata
    | MentionMetadata
    | PriorityChangeMetadata
    | Record<string, unknown>
    | StatusChangeMetadata
    | SubtaskChangeMetadata;

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

export type SubtaskChangeMetadata = {
    action: "closed" | "created";
    source?: "app" | "github_webhook";
    subtaskKey: string;
};

export type TaskWatcher = {
    avatarUrl: null | string;
    name: string;
    userId: string;
};
