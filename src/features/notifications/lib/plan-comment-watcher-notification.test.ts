import { describe, expect, it } from "vitest";

import { planCommentWatcherNotification } from "./plan-comment-watcher-notification";

describe("planCommentWatcherNotification", () => {
    it("plans Watcher comment on create and excludes Mentionees", () => {
        expect(
            planCommentWatcherNotification({
                action: "create",
                commentId: "c1",
                mentioneeIds: ["u-mentionee", "u-other"],
            })
        ).toEqual({
            excludeRecipientIds: ["u-mentionee", "u-other"],
            kind: "comment",
            metadata: {
                commentId: "c1",
                source: "app",
            },
        });
    });

    it("plans Watcher comment on create with no Mentionee excludes", () => {
        expect(
            planCommentWatcherNotification({
                action: "create",
                commentId: "c2",
                mentioneeIds: [],
            })
        ).toEqual({
            kind: "comment",
            metadata: {
                commentId: "c2",
                source: "app",
            },
        });
    });

    it("plans nothing when a Comment is edited", () => {
        expect(
            planCommentWatcherNotification({
                action: "edit",
                commentId: "c1",
                mentioneeIds: ["u-mentionee"],
            })
        ).toBeUndefined();
    });

    it("plans nothing without a commentId on create", () => {
        expect(
            planCommentWatcherNotification({
                action: "create",
                commentId: "",
                mentioneeIds: [],
            })
        ).toBeUndefined();
    });
});
