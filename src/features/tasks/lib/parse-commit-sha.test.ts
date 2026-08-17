import { describe, expect, it } from "vitest";

import { parseCommitSha } from "./parse-commit-sha";

describe("parseCommitSha", () => {
    it("accepts full and short SHAs", () => {
        const full = "c0ffee1a2b3c4d5e6f708192a3b4c5d6e7f8091a";
        expect(parseCommitSha(full)).toBe(full);
        expect(parseCommitSha("c0ffee1")).toBe("c0ffee1");
    });

    it("parses GitHub commit URLs", () => {
        expect(
            parseCommitSha(
                "https://github.com/org/repo/commit/deadbeef0123456789abcdef0123456789abcdef"
            )
        ).toBe("deadbeef0123456789abcdef0123456789abcdef");
    });

    it("rejects invalid input", () => {
        expect(parseCommitSha("")).toBeUndefined();
        expect(parseCommitSha("not-a-sha")).toBeUndefined();
        expect(parseCommitSha("abc")).toBeUndefined();
    });
});
