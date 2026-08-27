import { describe, expect, it } from "vitest";

import { shouldShowImageChrome } from "@/shared/ui/rich-text-editor/image-chrome";

describe("shouldShowImageChrome", () => {
    it("hides chrome for a boot NodeSelection while the editor is unfocused", () => {
        expect(
            shouldShowImageChrome({
                editorFocused: false,
                selected: true,
                toolbarInteracting: false,
                uploading: false,
            })
        ).toBe(false);
    });

    it("keeps chrome while width/height fields hold focus after editor blur", () => {
        // Bug: chrome keyed only on editorFocused — focusing W/H unmounts the
        // toolbar, so the second click of a text-select double-click hits the
        // image and opens the fullscreen preview.
        expect(
            shouldShowImageChrome({
                editorFocused: false,
                selected: true,
                toolbarInteracting: true,
                uploading: false,
            })
        ).toBe(true);
    });

    it("hides chrome while an upload is in flight", () => {
        expect(
            shouldShowImageChrome({
                editorFocused: true,
                selected: true,
                toolbarInteracting: true,
                uploading: true,
            })
        ).toBe(false);
    });
});
