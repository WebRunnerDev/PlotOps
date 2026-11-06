import { describe, expect, it } from "vitest";

import {
    extractTaskKeysFromText,
    normalizeGitReference,
    textReferencesTaskKey,
} from "./task-key";

describe("extractTaskKeysFromText", () => {
    it("finds keys in commit messages and PR titles", () => {
        expect(extractTaskKeysFromText("TASK-12: Fix login")).toEqual([
            "TASK-12",
        ]);
        expect(
            extractTaskKeysFromText("fix: handle edge case (BUG-5)")
        ).toEqual(["BUG-5"]);
        expect(
            extractTaskKeysFromText("[FEAT-42] Add palette shortcuts")
        ).toEqual(["FEAT-42"]);
    });

    it("finds a key anywhere in a branch name", () => {
        expect(extractTaskKeysFromText("feature/TASK-12-login")).toEqual([
            "TASK-12",
        ]);
        expect(extractTaskKeysFromText("TASK-1-login")).toEqual(["TASK-1"]);
        expect(extractTaskKeysFromText("TASK-1")).toEqual(["TASK-1"]);
        expect(extractTaskKeysFromText("user/foo-TASK-1")).toEqual(["TASK-1"]);
        expect(extractTaskKeysFromText("feature/task-7_login")).toEqual([
            "task-7",
        ]);
        expect(extractTaskKeysFromText("main")).toEqual([]);
    });

    it("never shortens a longer number", () => {
        expect(extractTaskKeysFromText("TASK-12")).not.toContain("TASK-1");
    });

    it("returns every key, deduped case-insensitively", () => {
        expect(extractTaskKeysFromText("task-12 and TASK-12")).toEqual([
            "task-12",
        ]);
        expect(
            extractTaskKeysFromText("TASK-1, TASK-2: shared login fix")
        ).toEqual(["TASK-1", "TASK-2"]);
    });
});

describe("normalizeGitReference", () => {
    it("strips refs and remotes", () => {
        expect(normalizeGitReference(" refs/heads/feature/TASK-1 ")).toBe(
            "feature/TASK-1"
        );
        expect(normalizeGitReference("origin/fix/BUG-2")).toBe("fix/BUG-2");
    });
});

describe("textReferencesTaskKey", () => {
    it("matches case-insensitively", () => {
        expect(textReferencesTaskKey("task-12: polish", "TASK-12")).toBe(true);
        expect(textReferencesTaskKey("unrelated change", "TASK-12")).toBe(
            false
        );
    });

    it("rejects partial GitHub-search false positives for TASK-4", () => {
        expect(
            textReferencesTaskKey(
                "fix(M-4): mobile backlog and CI/CD pages at 375px",
                "TASK-4"
            )
        ).toBe(false);
        expect(
            textReferencesTaskKey(
                "fix(boards): Wave 4 columns mutations, atomic R…",
                "TASK-4"
            )
        ).toBe(false);
        expect(
            textReferencesTaskKey("TASK-4: wire smart commits", "TASK-4")
        ).toBe(true);
    });
});
