import { describe, expect, it } from "vitest";

import { mergeCommitsBySha } from "./merge-commits";

describe("mergeCommitsBySha", () => {
    it("dedupes by sha preserving first occurrence", () => {
        const first = {
            author: {
                avatar_url: null,
                date: null,
                login: null,
                name: null,
            },
            message: "first",
            sha: "abc123",
            url: "https://example.com/abc123",
        };
        const second = { ...first, message: "second" };

        expect(mergeCommitsBySha([first], [second])).toEqual([first]);
    });
});
