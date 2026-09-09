import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * BootScreen already has the brand letter choreography as the loading moment.
 * A second indeterminate progress bar after it felt like a duplicate loader on
 * every platform visit (brand reveal → bar).
 */
describe("BootScreen loading affordance", () => {
    it("does not mount a sliding progress bar under the brand mark", () => {
        const source = readFileSync(
            path.join(dirname, "boot-screen.tsx"),
            "utf8"
        );

        expect(source).not.toMatch(/function\s+BootProgress\b/);
        expect(source).not.toMatch(/x:\s*\[\s*"-\d+%".*"\d+%"\s*\]/);
        expect(source).not.toMatch(/\btextShadow\b/);
        expect(source).not.toMatch(/\bclipPath\b/);
        expect(source).not.toMatch(/\bblur-\d/);
        expect(source).toMatch(/function\s+BrandMark\b/);
        expect(source).toMatch(/will-change-transform/);
    });
});
