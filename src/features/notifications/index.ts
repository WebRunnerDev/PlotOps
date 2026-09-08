export { createNotificationsForMentions } from "./api/notifications-api";
export {
    buildMentionFanOutRequest,
    type MentionFanOutRequest,
} from "./lib/build-mention-fan-out-request";
export { canManageTaskWatch } from "./lib/can-manage-task-watch";
export {
    extractMentioneeIds,
    newMentioneeIds,
} from "./lib/extract-mentionee-ids";
export { notifyCommentWatchersBestEffort } from "./lib/notify-comment-watchers";
export { notifyDescriptionWatchersBestEffort } from "./lib/notify-description-watchers";
export { notifyNewMentionsBestEffort } from "./lib/notify-new-mentions";
export { planAssigneeChangeNotifications } from "./lib/plan-assignee-change-notifications";
export { planAuthorChangeNotifications } from "./lib/plan-author-change-notifications";

export { planBoardMoveWatcherNotification } from "./lib/plan-board-move-watcher-notification";

export { planCommentWatcherNotification } from "./lib/plan-comment-watcher-notification";

export { planDescriptionWatcherNotification } from "./lib/plan-description-watcher-notification";

export { planPriorityWatcherNotification } from "./lib/plan-priority-watcher-notification";
export { planSubtaskChangeNotification } from "./lib/plan-subtask-change-notification";
export {
    planTaskNotificationEvents,
    type PlanTaskNotificationInput,
    type TaskNotificationEvent,
} from "./lib/plan-task-notification-events";

export { planTitleWatcherNotification } from "./lib/plan-title-watcher-notification";

export type {
    AssigneeChangeMetadata,
    AssignmentMetadata,
    AuthorChangeMetadata,
    BoardMoveMetadata,
    CommentMetadata,
    MentionMetadata,
    MentionSource,
    Notification,
    NotificationKind,
    NotificationMetadata,
    PriorityChangeMetadata,
    StatusChangeMetadata,
    SubtaskChangeMetadata,
    TaskWatcher,
} from "./model/types";

export {
    useCleanupNotificationsForUser,
    useMarkAllNotificationsRead,
    useMarkNotificationRead,
    useNotificationsList,
    useNotificationsRealtime,
    useUnreadNotificationsCount,
} from "./model/use-notifications";

export { useOpenNotification } from "./model/use-open-notification";

export {
    useAddTaskWatcher,
    useRemoveTaskWatcher,
    useTaskWatchers,
    useToggleTaskWatch,
} from "./model/use-task-watchers";

export { NotificationsBell } from "./ui/notifications-bell";
export { TaskWatchersList } from "./ui/task-watchers-list";
