import { describe, expect, it, vi } from "vitest";

import { copyCodeBlockText } from "@/shared/ui/rich-text-editor/copy-code-block";

describe("copyCodeBlockText", () => {
    it("writes plain text to the clipboard", async () => {
        const writeText = vi.fn(async () => {});

        const ok = await copyCodeBlockText('console.log("hi")', {
            clipboard: { writeText },
        });

        expect(ok).toBe(true);
        expect(writeText).toHaveBeenCalledWith('console.log("hi")');
    });

    it("returns false for empty text", async () => {
        expect(await copyCodeBlockText("")).toBe(false);
    });

    it("returns false when clipboard write fails", async () => {
        const writeText = vi.fn(async () => {
            throw new Error("denied");
        });

        const ok = await copyCodeBlockText("code", {
            clipboard: { writeText },
        });

        expect(ok).toBe(false);
    });
});
