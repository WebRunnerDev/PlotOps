import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)));

describe("selection bubble dismiss seams", () => {
    it("dismisses the formatting bubble on editor blur and selection mousedown", () => {
        const source = readFileSync(
            path.join(root, "rich-text-editor.tsx"),
            "utf8"
        );

        // Bug: selection bubble uses commands: [] so mousedown early-returned
        // without closing; drawer clicks blurred without collapsing PM selection
        // so onSelectionUpdate never ran and the menu stayed open.
        expect(source).toMatch(
            /mousedown:[\s\S]*?menuOpen\s*=\s*[\s\S]*?source === "selection"[\s\S]*?closeMenu\(\)/
        );
        expect(source).toMatch(
            /onBlur:\s*\(\{\s*event\s*\}\)\s*=>\s*\{[\s\S]*?focusMovedToMenu[\s\S]*?closeMenu\(\)/
        );
        expect(source).toMatch(
            /onMouseDown=\{\(event\)\s*=>\s*\{[\s\S]*?event\.preventDefault\(\)/
        );
    });
});
