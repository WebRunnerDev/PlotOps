import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)));

describe("rich-text image preview seams", () => {
    it("exposes open-for-view paths beyond node selection chrome", () => {
        const source = readFileSync(
            path.join(root, "image-node-view.tsx"),
            "utf8"
        );

        // Bug: click only NodeSelection + resize/copy toolbar — no lightbox.
        // Fix: double-click the frame and an explicit open control both call
        // openPreview, which mounts a Dialog with the image src.
        expect(source).toMatch(/onDoubleClick/);
        expect(source).toMatch(/openPreview/);
        expect(source).toMatch(/richText\.media\.open/);
        expect(source).toMatch(/previewOpen/);
        expect(source).toMatch(/<Dialog[\s\S]*src=\{source\}/);
    });
});
