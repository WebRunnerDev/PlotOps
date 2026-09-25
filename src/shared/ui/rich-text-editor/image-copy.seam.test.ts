import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)));

describe("rich-text image copy seams", () => {
    it("does not steal the native context menu from a selected image node", () => {
        const source = readFileSync(
            path.join(root, "rich-text-editor.tsx"),
            "utf8"
        );

        // Bug: any non-empty selection (including NodeSelection on an image)
        // hits preventDefault and replaces the browser "Copy image" menu.
        // Fix: bail out for image targets / NodeSelection so native copy works.
        const contextmenu = source.match(
            /contextmenu:\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\n\s{16}\},/
        )?.[0];
        expect(contextmenu).toBeDefined();
        expect(contextmenu!).toMatch(/rich-text-image-view/);
        expect(contextmenu!).toMatch(/hasTextSelection[\s\S]*return false/);

        // The NodeSelection guard itself lives in the helper the handler asks.
        const hasTextSelection = source.match(
            /function hasTextSelection\([\s\S]*?\n\}/
        )?.[0];
        expect(hasTextSelection).toBeDefined();
        expect(hasTextSelection!).toMatch(
            /!\s*\(\s*selection\s+instanceof\s+NodeSelection\s*\)/
        );
    });

    it("serializes image placeholders in manual text selection copy", () => {
        const source = readFileSync(
            path.join(root, "resizable-image.tsx"),
            "utf8"
        );

        expect(source).toMatch(/renderText:/);
        expect(source).toMatch(/formatImagePlainTextReference/);
    });
});
