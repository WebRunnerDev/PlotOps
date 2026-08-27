import { Editor } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)));

/**
 * TipTap 3 StarterKit bundles link + underline. Registering the standalone
 * packages on top emits:
 *   [tiptap warn]: Duplicate extension names found: ['link', 'underline']
 * on every editor mount (demo task drawer, comments, etc.).
 */
function createEditorWithMarks(
    starterOptions: Parameters<typeof StarterKit.configure>[0]
) {
    return new Editor({
        content: {
            content: [
                {
                    content: [{ text: "hi", type: "text" }],
                    type: "paragraph",
                },
            ],
            type: "doc",
        },
        extensions: [
            StarterKit.configure(starterOptions),
            Link.configure({
                autolink: true,
                defaultProtocol: "https",
                openOnClick: false,
            }),
            Underline,
        ],
    });
}

describe("rich-text TipTap link/underline registration", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("reproduces duplicate warn when StarterKit still owns link/underline", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const editor = createEditorWithMarks({ codeBlock: false });

        const messages = warn.mock.calls.map((arguments_) =>
            arguments_.map(String).join(" ")
        );
        expect(
            messages.some(
                (message) =>
                    message.includes("Duplicate extension names") &&
                    message.includes("link") &&
                    message.includes("underline")
            )
        ).toBe(true);

        editor.destroy();
    });

    it("stays quiet when StarterKit disables bundled link/underline", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const editor = createEditorWithMarks({
            codeBlock: false,
            link: false,
            underline: false,
        });

        const messages = warn.mock.calls.map((arguments_) =>
            arguments_.map(String).join(" ")
        );
        expect(
            messages.some((message) =>
                message.includes("Duplicate extension names")
            )
        ).toBe(false);
        expect(editor.schema.marks.link).toBeDefined();
        expect(editor.schema.marks.underline).toBeDefined();

        editor.destroy();
    });

    it("production editor disables StarterKit link/underline before standalone", () => {
        const source = readFileSync(
            path.join(root, "rich-text-editor.tsx"),
            "utf8"
        );

        expect(source).toMatch(/StarterKit\.configure\(\{[\s\S]*link:\s*false/);
        expect(source).toMatch(
            /StarterKit\.configure\(\{[\s\S]*underline:\s*false/
        );
        expect(source).toMatch(/Link\.configure\(/);
        expect(source).toMatch(/\bUnderline,/);
    });
});
