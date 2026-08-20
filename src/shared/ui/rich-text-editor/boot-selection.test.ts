import { Editor } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { NodeSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";

import { clearBootNodeSelection } from "@/shared/ui/rich-text-editor/boot-selection";

type DocumentContent = {
    content?: Array<{
        attrs?: { src: string };
        content?: Array<{ text: string; type: "text" }>;
        type: string;
    }>;
    type: "doc";
};

function createEditor(content: DocumentContent) {
    return new Editor({
        content,
        editable: true,
        extensions: [StarterKit, Image],
    });
}

describe("clearBootNodeSelection", () => {
    it("moves off an image that leads the document onto the following text", () => {
        const editor = createEditor({
            content: [
                { attrs: { src: "https://example.com/a.png" }, type: "image" },
                {
                    content: [{ text: "hello", type: "text" }],
                    type: "paragraph",
                },
            ],
            type: "doc",
        });

        expect(editor.state.selection).toBeInstanceOf(NodeSelection);
        expect(clearBootNodeSelection(editor)).toBe(true);
        expect(editor.state.selection).not.toBeInstanceOf(NodeSelection);
        expect(editor.state.selection.empty).toBe(true);

        editor.destroy();
    });

    it("leaves a trailing image alone when boot selection is already a caret", () => {
        const editor = createEditor({
            content: [
                {
                    content: [{ text: "hello", type: "text" }],
                    type: "paragraph",
                },
                { attrs: { src: "https://example.com/a.png" }, type: "image" },
            ],
            type: "doc",
        });

        expect(editor.state.selection).not.toBeInstanceOf(NodeSelection);
        expect(clearBootNodeSelection(editor)).toBe(false);

        editor.destroy();
    });

    it("returns false for an image-only document (no text caret available)", () => {
        const editor = createEditor({
            content: [
                { attrs: { src: "https://example.com/a.png" }, type: "image" },
            ],
            type: "doc",
        });

        expect(editor.state.selection).toBeInstanceOf(NodeSelection);
        expect(clearBootNodeSelection(editor)).toBe(false);
        expect(editor.state.selection).toBeInstanceOf(NodeSelection);

        editor.destroy();
    });
});
