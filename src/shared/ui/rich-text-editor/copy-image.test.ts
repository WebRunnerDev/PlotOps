import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { copyImageSourceToClipboard } from "@/shared/ui/rich-text-editor/copy-image";

describe("copyImageSourceToClipboard", () => {
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

    it("writes an image blob when fetch returns an image response", async () => {
        const blob = new Blob(["fake"], { type: "image/png" });
        const write = vi.fn(async () => {});
        const writeText = vi.fn(async () => {});
        const fetchImpl = vi.fn(async () => ({
            blob: async () => blob,
            ok: true,
        }));

        const result = await copyImageSourceToClipboard(
            "https://cdn.example/a.png",
            {
                clipboard: { write, writeText },
                fetchImpl: fetchImpl as unknown as typeof fetch,
            }
        );

        expect(result).toBe("bitmap");
        expect(write).toHaveBeenCalledTimes(1);
        expect(writeText).not.toHaveBeenCalled();
    });

    it("returns failed when bitmap copy is unavailable", async () => {
        const write = vi.fn(async () => {
            throw new Error("ClipboardItem rejected");
        });
        const writeText = vi.fn(async () => {});
        const fetchImpl = vi.fn(async () => ({
            blob: async () => new Blob(["fake"], { type: "image/png" }),
            ok: true,
        }));

        const result = await copyImageSourceToClipboard(
            "https://cdn.example/a.png",
            {
                clipboard: { write, writeText },
                fetchImpl: fetchImpl as unknown as typeof fetch,
            }
        );

        expect(result).toBe("failed");
        expect(writeText).not.toHaveBeenCalled();
    });

    it("returns failed for an empty src", async () => {
        expect(await copyImageSourceToClipboard("  ")).toBe("failed");
    });
});
