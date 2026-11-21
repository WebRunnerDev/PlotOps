import type { LucideIcon } from "lucide-react";

import {
    ArrowRightLeft,
    AtSign,
    CalendarClock,
    CircleDot,
    FileText,
    Flag,
    Gauge,
    ListTree,
    MessageSquare,
    PenLine,
    Repeat,
    Tag,
    Type,
    UserCheck,
    UserCog,
} from "lucide-react";

import type { NotificationKind } from "@/features/notifications/model/types";

const KIND_ICON: Record<NotificationKind, LucideIcon> = {
    assignee_change: UserCog,
    assignment: UserCheck,
    author_change: PenLine,
    board_move: ArrowRightLeft,
    comment: MessageSquare,
    deadline_change: CalendarClock,
    description_change: FileText,
    estimate_change: Gauge,
    labels_change: Tag,
    mention: AtSign,
    priority_change: Flag,
    sprint_change: Repeat,
    status_change: CircleDot,
    subtask_change: ListTree,
    title_change: Type,
};

/** Icon that identifies a Notification kind at a glance (paired with text). */
export function notificationKindIcon(kind: NotificationKind): LucideIcon {
    return KIND_ICON[kind] ?? CircleDot;
}
