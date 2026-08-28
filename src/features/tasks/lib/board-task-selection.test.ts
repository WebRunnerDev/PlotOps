import { describe, expect, it } from "vitest";

import {
    isBoardMultiSelectModifier,
    resolveColumnSelectionRange,
    shouldPreventBoardTaskTextSelection,
} from "./board-task-selection";

describe("isBoardMultiSelectModifier", () => {
    it("detects meta or ctrl", () => {
        expect(
            isBoardMultiSelectModifier({ ctrlKey: false, metaKey: true })
        ).toBe(true);
        expect(
            isBoardMultiSelectModifier({ ctrlKey: true, metaKey: false })
        ).toBe(true);
        expect(
            isBoardMultiSelectModifier({ ctrlKey: false, metaKey: false })
        ).toBe(false);
    });
});

describe("resolveColumnSelectionRange", () => {
    const column = ["a", "b", "c", "d", "e"];

    it("returns only target when anchor is missing", () => {
        expect(resolveColumnSelectionRange(column, null, "c")).toEqual(["c"]);
    });

    it("returns only target when anchor is outside the column", () => {
        expect(resolveColumnSelectionRange(column, "z", "c")).toEqual(["c"]);
    });

    it("returns inclusive range in column order", () => {
        expect(resolveColumnSelectionRange(column, "b", "d")).toEqual([
            "b",
            "c",
            "d",
        ]);
        expect(resolveColumnSelectionRange(column, "d", "b")).toEqual([
            "b",
            "c",
            "d",
        ]);
    });

    it("returns single id when anchor equals target", () => {
        expect(resolveColumnSelectionRange(column, "c", "c")).toEqual(["c"]);
    });
});

describe("shouldPreventBoardTaskTextSelection", () => {
    it("blocks selection when bulk-select is active or modifiers are held", () => {
        expect(
            shouldPreventBoardTaskTextSelection({
                ctrlKey: false,
                metaKey: false,
                selectionActive: false,
                selectionEnabled: false,
                shiftKey: true,
            })
        ).toBe(false);
        expect(
            shouldPreventBoardTaskTextSelection({
                ctrlKey: true,
                metaKey: false,
                selectionActive: false,
                selectionEnabled: true,
                shiftKey: false,
            })
        ).toBe(true);
        expect(
            shouldPreventBoardTaskTextSelection({
                ctrlKey: false,
                metaKey: false,
                selectionActive: true,
                selectionEnabled: true,
                shiftKey: false,
            })
        ).toBe(true);
    });
});
