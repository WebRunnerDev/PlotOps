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

    it("does not open formatting menus while the editor is read-only", () => {
        const source = readFileSync(
            path.join(root, "rich-text-editor.tsx"),
            "utf8"
        );

        // Bug: viewed comments use <RichTextEditor readOnly />; selecting
        // text still auto-opened the edit-only formatting bubble.
        expect(source).toMatch(
            /from\s+"@\/shared\/ui\/rich-text-editor\/selection-bubble"/
        );
        expect(source).toMatch(
            /onSelectionUpdate:[\s\S]*?shouldShowSelectionBubble\(/
        );
        expect(source).toMatch(
            /contextmenu:[\s\S]*?shouldShowSelectionBubble\(/
        );
    });
});
