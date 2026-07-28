export { planAssigneeChangeNotifications } from "./lib/plan-assignee-change-notifications";
export { planAuthorChangeNotifications } from "./lib/plan-author-change-notifications";
export { planBoardMoveWatcherNotification } from "./lib/plan-board-move-watcher-notification";
export { planPriorityWatcherNotification } from "./lib/plan-priority-watcher-notification";

export {
    planTaskNotificationEvents,
    type PlanTaskNotificationInput,
    type TaskNotificationEvent,
} from "./lib/plan-task-notification-events";

export type {
    AssigneeChangeMetadata,
    AssignmentMetadata,
    AuthorChangeMetadata,
    BoardMoveMetadata,
    Notification,
    NotificationKind,
    NotificationMetadata,
    PriorityChangeMetadata,
    StatusChangeMetadata,
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

export { useTaskWatchers, useToggleTaskWatch } from "./model/use-task-watchers";

export { NotificationsBell } from "./ui/notifications-bell";
export { TaskWatchersList } from "./ui/task-watchers-list";
