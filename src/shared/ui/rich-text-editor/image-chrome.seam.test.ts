import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)));

describe("rich-text image chrome seams", () => {
    it("keeps resize fields mounted when they steal focus from the editor", () => {
        const source = readFileSync(
            path.join(root, "image-node-view.tsx"),
            "utf8"
        );

        // Bug: isActivelySelected = selected && editorFocused. Focusing W/H
        // blurs the editor, chrome unmounts, and a double-click to edit the
        // field value lands on the bitmap → fullscreen preview.
        // Fix: shouldShowImageChrome also treats toolbar focus as active.
        expect(source).toMatch(/shouldShowImageChrome/);
        expect(source).toMatch(/setToolbarInteracting/);
        // mousedown must arm interacting *before* editor blur unmounts chrome.
        expect(source).toMatch(
            /rich-text-image-toolbar[\s\S]*onMouseDown=\{\(\)\s*=>\s*setToolbarInteracting\(true\)\}/
        );
    });
});
