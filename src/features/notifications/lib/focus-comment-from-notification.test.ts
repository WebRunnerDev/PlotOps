import { describe, expect, it } from "vitest";

import type { Notification } from "@/features/notifications/model/types";

import { focusCommentIdFromNotification } from "./focus-comment-from-notification";

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

describe("focusCommentIdFromNotification", () => {
    it("returns commentId for Comment Mentions", () => {
        expect(
            focusCommentIdFromNotification(
                notification({
                    kind: "mention",
                    metadata: {
                        actor: { id: "u1", name: "Sam" },
                        commentId: "c1",
                        source: "comment",
                    },
                })
            )
        ).toBe("c1");
    });

    it("returns undefined for Description Mentions", () => {
        expect(
            focusCommentIdFromNotification(
                notification({
                    kind: "mention",
                    metadata: {
                        actor: { id: "u1", name: "Sam" },
                        source: "description",
                    },
                })
            )
        ).toBeUndefined();
    });

    it("returns undefined when Comment Mention has no commentId", () => {
        expect(
            focusCommentIdFromNotification(
                notification({
                    kind: "mention",
                    metadata: {
                        actor: { id: "u1", name: "Sam" },
                        source: "comment",
                    },
                })
            )
        ).toBeUndefined();
    });

    it("returns undefined for non-mention kinds", () => {
        expect(
            focusCommentIdFromNotification(
                notification({
                    kind: "assignment",
                    metadata: {
                        assignee: { id: "u2", name: "Alex" },
                    },
                })
            )
        ).toBeUndefined();
    });
});
