import { describe, expect, it } from "vitest";

import type { Notification } from "@/features/notifications/model/types";

import { formatNotificationContext } from "./format-notification-context";

const t = ((key: string, options?: Record<string, string>) => {
    const catalog: Record<string, string> = {
        "notifications.kinds.assignment": "You were assigned",
        "notifications.kinds.assignmentDetail": `Assigned to ${options?.name ?? ""}`,
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
});
