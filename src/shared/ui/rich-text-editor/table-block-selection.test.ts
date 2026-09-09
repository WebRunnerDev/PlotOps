import { Editor } from "@tiptap/core";
import { TableKit } from "@tiptap/extension-table";
import { TextSelection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";

import { collectTableBlockDecorations } from "@/shared/ui/rich-text-editor/table-block-selection";

function cell(text: string, type: "tableCell" | "tableHeader" = "tableCell") {
    return {
        content: [
            {
                content: text ? [{ text, type: "text" as const }] : undefined,
                type: "paragraph" as const,
            },
        ],
        type,
    };
}

function createEditor() {
    return new Editor({
        content: {
            content: [
                {
                    content: [{ text: "Before", type: "text" }],
                    type: "paragraph",
                },
                {
                    content: [
                        {
                            content: [
                                cell("A", "tableHeader"),
                                cell("B", "tableHeader"),
                            ],
                            type: "tableRow",
                        },
                        {
                            content: [cell("1"), cell("2")],
                            type: "tableRow",
                        },
                    ],
                    type: "table",
                },
                {
                    content: [{ text: "After", type: "text" }],
                    type: "paragraph",
                },
            ],
            type: "doc",
        },
        extensions: [
            StarterKit.configure({ codeBlock: false }),
            TableKit.configure({
                table: {
                    allowTableNodeSelection: true,
                    renderWrapper: true,
                    resizable: true,
                },
            }),
        ],
    });
}

function findPos(
    editor: Editor,
    predicate: (node: {
        nodeSize: number;
        textContent: string;
        type: { name: string };
    }) => boolean
): number {
    let found = -1;
    editor.state.doc.descendants((node, pos) => {
        if (found >= 0) return false;
        if (predicate(node)) {
            found = pos;
            return false;
        }
        return true;
    });
    if (found < 0) throw new Error("node not found");
    return found;
}

describe("collectTableBlockDecorations", () => {
    let editor: Editor;

    afterEach(() => {
        editor?.destroy();
    });

    it("decorates the whole table when selection includes text outside it", () => {
        editor = createEditor();
        const { doc } = editor.state;
        const selection = TextSelection.create(doc, 1, doc.content.size - 1);
        const decorations = collectTableBlockDecorations(doc, selection);

        expect(decorations.some((item) => item.kind === "table")).toBe(true);
        expect(decorations.filter((item) => item.kind === "cell")).toHaveLength(
            4
        );
    });

    it("does not decorate when selection stays inside a single cell", () => {
        editor = createEditor();
        const cellPos = findPos(
            editor,
            (node) => node.type.name === "tableCell" && node.textContent === "1"
        );
        const selection = TextSelection.create(
            editor.state.doc,
            cellPos + 2,
            cellPos + 3
        );
        expect(
            collectTableBlockDecorations(editor.state.doc, selection)
        ).toEqual([]);
    });

    it("decorates only overlapping cells when selection enters from outside", () => {
        editor = createEditor();
        const headerA = findPos(
            editor,
            (node) =>
                node.type.name === "tableHeader" && node.textContent === "A"
        );
        // From "Before" into the text of header A (does not reach header B).
        const selection = TextSelection.create(
            editor.state.doc,
            1,
            headerA + 3
        );
        const decorations = collectTableBlockDecorations(
            editor.state.doc,
            selection
        );

        expect(decorations.some((item) => item.kind === "table")).toBe(true);
        const cells = decorations.filter((item) => item.kind === "cell");
        expect(cells).toHaveLength(1);
        expect(cells[0]?.from).toBe(headerA);
    });

    it("skips CellSelection (handled by prosemirror-tables)", () => {
        editor = createEditor();
        const cellPos = findPos(
            editor,
            (node) => node.type.name === "tableCell" && node.textContent === "1"
        );
        const selection = CellSelection.create(editor.state.doc, cellPos);
        expect(
            collectTableBlockDecorations(editor.state.doc, selection)
        ).toEqual([]);
    });
});
