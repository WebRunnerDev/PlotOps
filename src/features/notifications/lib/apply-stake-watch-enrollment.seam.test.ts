import { describe, expect, it } from "vitest";

import { applyStakeWatchEnrollment } from "./apply-stake-watch-enrollment";

describe("applyStakeWatchEnrollment", () => {
    it("keeps Watch when Assignee is cleared", () => {
        expect(
            applyStakeWatchEnrollment({
                next: { assigneeId: null, authorId: "author-1" },
                previous: { assigneeId: "assignee-1", authorId: "author-1" },
                watcherIds: ["author-1", "assignee-1"],
            }).toSorted()
        ).toEqual(["assignee-1", "author-1"]);
    });

    it("keeps previous Author Watch and enrolls new Author on transfer", () => {
        expect(
            applyStakeWatchEnrollment({
                next: { assigneeId: null, authorId: "author-2" },
                previous: { assigneeId: null, authorId: "author-1" },
                watcherIds: ["author-1"],
            }).toSorted()
        ).toEqual(["author-1", "author-2"]);
    });

    it("enrolls Assignee when set", () => {
        expect(
            applyStakeWatchEnrollment({
                next: { assigneeId: "assignee-1", authorId: "author-1" },
                previous: { assigneeId: null, authorId: "author-1" },
                watcherIds: ["author-1"],
            }).toSorted()
        ).toEqual(["assignee-1", "author-1"]);
    });

    it("does not re-enroll Assignee after sticky Unwatch when Author transfers", () => {
        expect(
            applyStakeWatchEnrollment({
                next: {
                    assigneeId: "assignee-1",
                    authorId: "author-2",
                },
                previous: {
                    assigneeId: "assignee-1",
                    authorId: "author-1",
                },
                // Assignee manually Unwatched while still Assignee
                watcherIds: ["author-1"],
            }).toSorted()
        ).toEqual(["author-1", "author-2"]);
    });

    it("re-enrolls Assignee after sticky Unwatch when Assignee is set onto them again", () => {
        expect(
            applyStakeWatchEnrollment({
                next: {
                    assigneeId: "assignee-1",
                    authorId: "author-1",
                },
                previous: {
                    assigneeId: "other-assignee",
                    authorId: "author-1",
                },
                watcherIds: ["author-1"],
            }).toSorted()
        ).toEqual(["assignee-1", "author-1"]);
    });

    it("re-enrolls Author after sticky Unwatch when Author is set onto them again", () => {
        expect(
            applyStakeWatchEnrollment({
                next: { assigneeId: null, authorId: "author-1" },
                previous: { assigneeId: null, authorId: "author-2" },
                watcherIds: [],
            })
        ).toEqual(["author-1"]);
    });
});
