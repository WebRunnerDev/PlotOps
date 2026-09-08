import { describe, expect, it } from "vitest";

import { applyCommentWatchEnrollment } from "./apply-comment-watch-enrollment";

describe("applyCommentWatchEnrollment", () => {
    it("enrolls the commenter on Comment create when not already Watching", () => {
        expect(
            applyCommentWatchEnrollment({
                action: "create",
                commenterId: "user-1",
                watcherIds: ["author-1"],
            }).toSorted()
        ).toEqual(["author-1", "user-1"]);
    });

    it("is a no-op when the commenter is already Watching", () => {
        expect(
            applyCommentWatchEnrollment({
                action: "create",
                commenterId: "user-1",
                watcherIds: ["user-1", "author-1"],
            }).toSorted()
        ).toEqual(["author-1", "user-1"]);
    });

    it("re-enrolls after sticky Unwatch on Comment create", () => {
        expect(
            applyCommentWatchEnrollment({
                action: "create",
                commenterId: "user-1",
                watcherIds: [],
            })
        ).toEqual(["user-1"]);
    });

    it("does not enroll on Comment edit", () => {
        expect(
            applyCommentWatchEnrollment({
                action: "edit",
                commenterId: "user-1",
                watcherIds: ["author-1"],
            })
        ).toEqual(["author-1"]);
    });
});
