import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { copyRichTextToClipboard } from "@/shared/ui/rich-text-editor/copy-rich-text";

describe("copyRichTextToClipboard", () => {
    beforeEach(() => {
        vi.stubGlobal(
            "ClipboardItem",
            class ClipboardItem {
                items: Record<string, Blob>;
                constructor(items: Record<string, Blob>) {
                    this.items = items;
                }
            }
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("writes html and plain text together", async () => {
        const write = vi.fn(async () => {});
        const writeText = vi.fn(async () => {});

        const copied = await copyRichTextToClipboard(
            "<p><strong>Bug</strong></p><p>See</p>",
            "Bug\n\nSee",
            { clipboard: { write, writeText } }
        );

        expect(copied).toBe(true);
        expect(write).toHaveBeenCalledTimes(1);
        expect(writeText).not.toHaveBeenCalled();
    });

    it("falls back to plain text when rich clipboard write fails", async () => {
        const write = vi.fn(async () => {
            throw new Error("denied");
        });
        const writeText = vi.fn(async () => {});

        const copied = await copyRichTextToClipboard("<p>Bug</p>", "Bug", {
            clipboard: { write, writeText },
        });

        expect(copied).toBe(true);
        expect(writeText).toHaveBeenCalledWith("Bug");
    });
});
