export type AssignmentMetadata = {
    assignee: { id: string; name: string };
    previousAssignee?: null | { id: string; name: string };
    source?: "app" | "github_webhook";
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

export type NotificationKind = "assignment" | "status_change";

export type NotificationMetadata =
    AssignmentMetadata | Record<string, unknown> | StatusChangeMetadata;

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
