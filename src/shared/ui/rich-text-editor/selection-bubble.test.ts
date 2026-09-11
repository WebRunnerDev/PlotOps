import { describe, expect, it } from "vitest";

import { shouldShowSelectionBubble } from "@/shared/ui/rich-text-editor/selection-bubble";

describe("shouldShowSelectionBubble", () => {
    it("hides the formatting bubble when the editor is read-only", () => {
        // Bug: selecting text in a viewed comment still opened Bold/Italic/etc.
        expect(
            shouldShowSelectionBubble({
                editable: false,
                hasTextSelection: true,
            })
        ).toBe(false);
    });

    it("shows the formatting bubble for a text selection while editing", () => {
        expect(
            shouldShowSelectionBubble({
                editable: true,
                hasTextSelection: true,
            })
        ).toBe(true);
    });

    it("hides the bubble when the caret is collapsed", () => {
        expect(
            shouldShowSelectionBubble({
                editable: true,
                hasTextSelection: false,
            })
        ).toBe(false);
    });
});
