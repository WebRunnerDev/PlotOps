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
        expect(contextmenu!).toMatch(
            /selection\s+instanceof\s+NodeSelection[\s\S]*return false/
        );
    });
});
