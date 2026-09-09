import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)));

describe("table block selection registration", () => {
    it("registers TableBlockSelection next to TableKit in the editor", () => {
        const source = readFileSync(
            path.join(root, "rich-text-editor.tsx"),
            "utf8"
        );
        expect(source).toMatch(
            /import\s+\{\s*TableBlockSelection\s*\}\s+from\s+"@\/shared\/ui\/rich-text-editor\/table-block-selection"/
        );
        expect(source).toMatch(
            /TableKit\.configure\([\s\S]*?\),\s*TableBlockSelection,/
        );
    });

    it("suppresses native ::selection inside block-selected tables", () => {
        const css = readFileSync(
            path.join(root, "rich-text-editor.css"),
            "utf8"
        );
        expect(css).toMatch(/\.table-block-selected[\s\S]*user-select:\s*none/);
        expect(css).toMatch(/\.table-block-selected[\s\S]*::selection/);
        expect(css).toMatch(/background:\s*transparent/);
    });
});
