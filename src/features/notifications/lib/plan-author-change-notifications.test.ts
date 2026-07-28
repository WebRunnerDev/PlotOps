import { describe, expect, it } from "vitest";

import { planAuthorChangeNotifications } from "./plan-author-change-notifications";

describe("planAuthorChangeNotifications", () => {
    it("plans always-on and Watcher author_change when Author is transferred", () => {
        expect(
            planAuthorChangeNotifications([
                {
                    field: "author",
                    from: { id: "u1", name: "Sam" },
                    to: { id: "u3", name: "Riley" },
                },
            ])
        ).toEqual([
            {
                kind: "author_change",
                metadata: {
                    author: { id: "u3", name: "Riley" },
                    previousAuthor: { id: "u1", name: "Sam" },
                    source: "app",
                },
                recipientId: "u3",
            },
            {
                kind: "author_change",
                metadata: {
                    author: { id: "u3", name: "Riley" },
                    previousAuthor: { id: "u1", name: "Sam" },
                    source: "app",
                },
            },
        ]);
    });

    it("plans both kinds when Author is set from empty", () => {
        expect(
            planAuthorChangeNotifications([
                {
                    field: "author",
                    from: null,
                    to: { id: "u3", name: "Riley" },
                },
            ])
        ).toEqual([
            {
                kind: "author_change",
                metadata: {
                    author: { id: "u3", name: "Riley" },
                    previousAuthor: null,
                    source: "app",
                },
                recipientId: "u3",
            },
            {
                kind: "author_change",
                metadata: {
                    author: { id: "u3", name: "Riley" },
                    previousAuthor: null,
                    source: "app",
                },
            },
        ]);
    });

    it("plans nothing when Author is cleared", () => {
        expect(
            planAuthorChangeNotifications([
                {
                    field: "author",
                    from: { id: "u1", name: "Sam" },
                    to: null,
                },
            ])
        ).toEqual([]);
    });

    it("plans nothing when Author did not change", () => {
        expect(
            planAuthorChangeNotifications([
                { field: "title", from: "A", to: "B" },
                {
                    field: "assignee",
                    from: null,
                    to: { id: "u2", name: "Alex" },
                },
            ])
        ).toEqual([]);
    });
});
