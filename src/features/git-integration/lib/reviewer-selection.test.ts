import { describe, expect, it } from "vitest";

import {
    normalizeReviewerLogin,
    reviewerLoginStatus,
    sameLogin,
} from "@/features/git-integration/lib/reviewer-selection";

describe("normalizeReviewerLogin", () => {
    it("trims and strips a leading @", () => {
        expect(normalizeReviewerLogin("  @octocat ")).toBe("octocat");
        expect(normalizeReviewerLogin("mona-lisa")).toBe("mona-lisa");
    });

    it("rejects malformed logins", () => {
        expect(normalizeReviewerLogin("")).toBeUndefined();
        expect(normalizeReviewerLogin("@")).toBeUndefined();
        expect(normalizeReviewerLogin("two words")).toBeUndefined();
        expect(normalizeReviewerLogin("-leading")).toBeUndefined();
        expect(normalizeReviewerLogin("trailing-")).toBeUndefined();
        expect(normalizeReviewerLogin("double--hyphen")).toBeUndefined();
        expect(normalizeReviewerLogin("a".repeat(40))).toBeUndefined();
    });
});

describe("reviewerLoginStatus", () => {
    const base = { authorLogin: "Author", requestedLogins: ["Pending"] };

    it("accepts a fresh login", () => {
        expect(reviewerLoginStatus({ ...base, login: "@octocat" })).toBe("ok");
    });

    it("flags the PR author case-insensitively", () => {
        expect(reviewerLoginStatus({ ...base, login: "author" })).toBe(
            "author"
        );
    });

    it("flags an already-requested reviewer case-insensitively", () => {
        expect(reviewerLoginStatus({ ...base, login: "pending" })).toBe(
            "already_requested"
        );
    });

    it("flags malformed input", () => {
        expect(reviewerLoginStatus({ ...base, login: "not a login" })).toBe(
            "invalid"
        );
    });

    it("works without a known author", () => {
        expect(
            reviewerLoginStatus({
                authorLogin: null,
                login: "author",
                requestedLogins: [],
            })
        ).toBe("ok");
    });
});

describe("sameLogin", () => {
    it("compares case-insensitively", () => {
        expect(sameLogin("OctoCat", "octocat")).toBe(true);
        expect(sameLogin("octocat", "octodog")).toBe(false);
    });
});
