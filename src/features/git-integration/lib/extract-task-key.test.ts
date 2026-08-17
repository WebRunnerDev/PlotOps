import { describe, expect, it } from "vitest";

import {
    extractTaskKeyFromBranch,
    extractTaskKeysFromText,
    textReferencesTaskKey,
} from "./extract-task-key";

describe("extractTaskKeysFromText", () => {
    it("finds keys in commit messages", () => {
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

    it("dedupes case-insensitively", () => {
        expect(extractTaskKeysFromText("task-12 and TASK-12")).toEqual([
            "task-12",
        ]);
    });
});

describe("extractTaskKeyFromBranch", () => {
    it("parses feature branch slugs", () => {
        expect(extractTaskKeyFromBranch("feature/TASK-12-login")).toBe(
            "TASK-12"
        );
        expect(extractTaskKeyFromBranch("fix/BUG-5-crash")).toBe("BUG-5");
    });
});

describe("textReferencesTaskKey", () => {
    it("matches case-insensitively", () => {
        expect(textReferencesTaskKey("task-12: polish", "TASK-12")).toBe(true);
        expect(textReferencesTaskKey("unrelated change", "TASK-12")).toBe(
            false
        );
    });
});
