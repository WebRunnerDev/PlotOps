import { describe, expect, it } from "vitest";

import { buildMentionFanOutRequest } from "./build-mention-fan-out-request";

describe("buildMentionFanOutRequest", () => {
    it("builds a description Mention fan-out request for Mentionees", () => {
        expect(
            buildMentionFanOutRequest({
                actorName: "Ada",
                mentioneeIds: ["user-1", "user-2"],
                source: "description",
                taskId: "task-1",
            })
        ).toEqual({
            actorName: "Ada",
            commentId: null,
            mentioneeIds: ["user-1", "user-2"],
            source: "description",
            taskId: "task-1",
        });
    });

    it("keeps commentId for Comment Mentions", () => {
        expect(
            buildMentionFanOutRequest({
                actorName: "Ada",
                commentId: "comment-1",
                mentioneeIds: ["user-1"],
                source: "comment",
                taskId: "task-1",
            })
        ).toEqual({
            actorName: "Ada",
            commentId: "comment-1",
            mentioneeIds: ["user-1"],
            source: "comment",
            taskId: "task-1",
        });
    });

    it("drops commentId when source is description", () => {
        expect(
            buildMentionFanOutRequest({
                actorName: "Ada",
                commentId: "comment-1",
                mentioneeIds: ["user-1"],
                source: "description",
                taskId: "task-1",
            })?.commentId
        ).toBeNull();
    });

    it("plans nothing when there are no Mentionees", () => {
        expect(
            buildMentionFanOutRequest({
                actorName: "Ada",
                mentioneeIds: [],
                source: "description",
                taskId: "task-1",
            })
        ).toBeUndefined();
    });

    it("preserves duplicate Mentionee ids for the RPC to dedupe", () => {
        expect(
            buildMentionFanOutRequest({
                actorName: "Ada",
                mentioneeIds: ["user-1", "user-1"],
                source: "description",
                taskId: "task-1",
            })?.mentioneeIds
        ).toEqual(["user-1", "user-1"]);
    });
});
