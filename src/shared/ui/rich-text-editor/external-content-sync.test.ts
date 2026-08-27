import { describe, expect, it } from "vitest";

import { shouldApplyExternalContent } from "@/shared/ui/rich-text-editor/external-content-sync";

describe("shouldApplyExternalContent", () => {
    it("does not apply a stale parent value while an image upload is pending", () => {
        expect(
            shouldApplyExternalContent({
                currentHtml:
                    '<p>hello</p><img src="blob:https://local/1" class="rich-text-image">',
                nextHtml: "<p>hello</p>",
                pendingUploads: 1,
            })
        ).toBe(false);
    });

    it("applies external content when uploads are idle and HTML differs", () => {
        expect(
            shouldApplyExternalContent({
                currentHtml: "<p>hello</p>",
                nextHtml:
                    '<p>hello</p><img src="https://cdn.example/a.png" class="rich-text-image">',
                pendingUploads: 0,
            })
        ).toBe(true);
    });

    it("skips a no-op sync when HTML already matches", () => {
        expect(
            shouldApplyExternalContent({
                currentHtml: "<p>hello</p>",
                nextHtml: "<p>hello</p>",
                pendingUploads: 0,
            })
        ).toBe(false);
    });
});
