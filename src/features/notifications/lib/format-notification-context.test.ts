import { describe, expect, it } from "vitest";

import type { Notification } from "@/features/notifications/model/types";

import { formatNotificationContext } from "./format-notification-context";

const t = ((key: string, options?: Record<string, string>) => {
    const catalog: Record<string, string> = {
        "notifications.kinds.assigneeChange": "Assignee changed",
        "notifications.kinds.assigneeChangeDetail": `Assignee → ${options?.name ?? ""}`,
        "notifications.kinds.assigneeChangeFromDetail": `${options?.from ?? ""} → ${options?.to ?? ""}`,
        "notifications.kinds.assignment": "You were assigned",
        "notifications.kinds.assignmentDetail": `Assigned to ${options?.name ?? ""}`,
        "notifications.kinds.authorChange": "Author changed",
        "notifications.kinds.authorChangeDetail": `Author → ${options?.name ?? ""}`,
        "notifications.kinds.authorChangeFromDetail": `${options?.from ?? ""} → ${options?.to ?? ""}`,
        "notifications.kinds.boardMove": "Moved to another Board",
        "notifications.kinds.boardMoveDetail": `${options?.fromBoard ?? ""} → ${options?.toBoard ?? ""}`,
        "notifications.kinds.boardMoveStatusDetail": `${options?.fromBoard ?? ""} → ${options?.toBoard ?? ""} (${options?.fromStatus ?? ""} → ${options?.toStatus ?? ""})`,
        "notifications.kinds.deadlineChange": "Deadline changed",
        "notifications.kinds.deadlineChangeClearedDetail": `Deadline cleared (was ${options?.from ?? ""})`,
        "notifications.kinds.deadlineChangeDetail": `${options?.from ?? ""} → ${options?.to ?? ""}`,
        "notifications.kinds.deadlineChangeSetDetail": `Deadline set to ${options?.to ?? ""}`,
        "notifications.kinds.mention": "You were mentioned",
        "notifications.kinds.mentionComment": "You were mentioned in a Comment",
        "notifications.kinds.mentionCommentDetail": `${options?.name ?? ""} mentioned you in a Comment`,
        "notifications.kinds.mentionDescription":
            "You were mentioned in the Description",
        "notifications.kinds.mentionDescriptionDetail": `${options?.name ?? ""} mentioned you in the Description`,
        "notifications.kinds.priorityChange": "Priority changed",
        "notifications.kinds.priorityChangeDetail": `${options?.from ?? ""} → ${options?.to ?? ""}`,
        "notifications.kinds.statusChange": "Status changed",
        "notifications.kinds.statusChangeDetail": `${options?.from ?? ""} → ${options?.to ?? ""}`,
        "notifications.priority.high": "High",
        "notifications.priority.medium": "Medium",
        "notifications.priority.none": "No priority",
        "notifications.priority.urgent": "Urgent",
    };
    return catalog[key] ?? key;
}) as Parameters<typeof formatNotificationContext>[1];

function notification(
    partial: Pick<Notification, "kind" | "metadata">
): Notification {
    return {
        createdAt: "2026-07-28T00:00:00.000Z",
        id: "n1",
        projectId: "p1",
        readAt: null,
        taskId: "t1",
        taskKey: "CORE-1",
        taskTitle: "Login",
        ...partial,
    };
}

describe("formatNotificationContext", () => {
    it("shows always-on assignment as You were assigned (ignores assignee name)", () => {
        expect(
            formatNotificationContext(
                notification({
                    kind: "assignment",
                    metadata: {
                        assignee: { id: "u2", name: "Alex" },
                    },
                }),
                t
            )
        ).toBe("You were assigned");
    });

    it("shows Watcher assignee_change from → to without assignment copy", () => {
        expect(
            formatNotificationContext(
                notification({
                    kind: "assignee_change",
                    metadata: {
                        assignee: { id: "u4", name: "Jordan" },
                        previousAssignee: { id: "u2", name: "Alex" },
                    },
                }),
                t
            )
        ).toBe("Alex → Jordan");
    });

    it("shows Watcher assignee_change set with new Assignee name only", () => {
        expect(
            formatNotificationContext(
                notification({
                    kind: "assignee_change",
                    metadata: {
                        assignee: { id: "u2", name: "Alex" },
                    },
                }),
                t
            )
        ).toBe("Assignee → Alex");
    });

    it("falls back when assignee_change metadata is incomplete", () => {
        expect(
            formatNotificationContext(
                notification({
                    kind: "assignee_change",
                    metadata: {},
                }),
                t
            )
        ).toBe("Assignee changed");
    });

    it("shows author_change from → to for Author transfer", () => {
        expect(
            formatNotificationContext(
                notification({
                    kind: "author_change",
                    metadata: {
                        author: { id: "u3", name: "Riley" },
                        previousAuthor: { id: "u1", name: "Sam" },
                    },
                }),
                t
            )
        ).toBe("Sam → Riley");
    });

    it("shows author_change set with new Author name only", () => {
        expect(
            formatNotificationContext(
                notification({
                    kind: "author_change",
                    metadata: {
                        author: { id: "u3", name: "Riley" },
                    },
                }),
                t
            )
        ).toBe("Author → Riley");
    });

    it("falls back when author_change metadata is incomplete", () => {
        expect(
            formatNotificationContext(
                notification({
                    kind: "author_change",
                    metadata: {},
                }),
                t
            )
        ).toBe("Author changed");
    });

    it("shows Priority from → to labels for priority_change", () => {
        expect(
            formatNotificationContext(
                notification({
                    kind: "priority_change",
                    metadata: { from: "medium", to: "urgent" },
                }),
                t
            )
        ).toBe("Medium → Urgent");
    });

    it("falls back when Priority metadata is incomplete", () => {
        expect(
            formatNotificationContext(
                notification({
                    kind: "priority_change",
                    metadata: {},
                }),
                t
            )
        ).toBe("Priority changed");
    });

    it("shows deadline_change from → to", () => {
        expect(
            formatNotificationContext(
                notification({
                    kind: "deadline_change",
                    metadata: { from: "2026-07-01", to: "2026-07-15" },
                }),
                t
            )
        ).toBe("2026-07-01 → 2026-07-15");
    });

    it("shows deadline_change set and clear", () => {
        expect(
            formatNotificationContext(
                notification({
                    kind: "deadline_change",
                    metadata: { from: null, to: "2026-07-15" },
                }),
                t
            )
        ).toBe("Deadline set to 2026-07-15");
        expect(
            formatNotificationContext(
                notification({
                    kind: "deadline_change",
                    metadata: { from: "2026-07-15", to: null },
                }),
                t
            )
        ).toBe("Deadline cleared (was 2026-07-15)");
    });

    it("falls back when deadline_change metadata is incomplete", () => {
        expect(
            formatNotificationContext(
                notification({
                    kind: "deadline_change",
                    metadata: { from: null, to: null },
                }),
                t
            )
        ).toBe("Deadline changed");
    });

    it("keeps status_change detail formatting", () => {
        expect(
            formatNotificationContext(
                notification({
                    kind: "status_change",
                    metadata: {
                        from: { id: "todo", name: "Todo" },
                        to: { id: "doing", name: "Doing" },
                    },
                }),
                t
            )
        ).toBe("Todo → Doing");
    });

    it("shows Board from → to with status remap for board_move", () => {
        expect(
            formatNotificationContext(
                notification({
                    kind: "board_move",
                    metadata: {
                        fromBoard: { id: "b1", name: "Core" },
                        fromStatus: { id: "todo", name: "Todo" },
                        toBoard: { id: "b2", name: "Frontend" },
                        toStatus: { id: "backlog", name: "Backlog" },
                    },
                }),
                t
            )
        ).toBe("Core → Frontend (Todo → Backlog)");
    });

    it("falls back to Board names when status remap is absent", () => {
        expect(
            formatNotificationContext(
                notification({
                    kind: "board_move",
                    metadata: {
                        fromBoard: { id: "b1", name: "Core" },
                        toBoard: { id: "b2", name: "Frontend" },
                    },
                }),
                t
            )
        ).toBe("Core → Frontend");
    });

    it("falls back when board_move metadata is incomplete", () => {
        expect(
            formatNotificationContext(
                notification({
                    kind: "board_move",
                    metadata: {},
                }),
                t
            )
        ).toBe("Moved to another Board");
    });

    it("shows Mention in Description with actor name", () => {
        expect(
            formatNotificationContext(
                notification({
                    kind: "mention",
                    metadata: {
                        actor: { id: "u1", name: "Sam" },
                        source: "description",
                    },
                }),
                t
            )
        ).toBe("Sam mentioned you in the Description");
    });

    it("shows Mention in Comment with actor name", () => {
        expect(
            formatNotificationContext(
                notification({
                    kind: "mention",
                    metadata: {
                        actor: { id: "u1", name: "Sam" },
                        commentId: "c1",
                        source: "comment",
                    },
                }),
                t
            )
        ).toBe("Sam mentioned you in a Comment");
    });

    it("keeps Description vs Comment context without actor name", () => {
        expect(
            formatNotificationContext(
                notification({
                    kind: "mention",
                    metadata: { source: "comment" },
                }),
                t
            )
        ).toBe("You were mentioned in a Comment");
        expect(
            formatNotificationContext(
                notification({
                    kind: "mention",
                    metadata: { source: "description" },
                }),
                t
            )
        ).toBe("You were mentioned in the Description");
    });

    it("falls back when mention metadata is incomplete", () => {
        expect(
            formatNotificationContext(
                notification({
                    kind: "mention",
                    metadata: {},
                }),
                t
            )
        ).toBe("You were mentioned");
    });
});
