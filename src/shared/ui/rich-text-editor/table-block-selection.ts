import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

import { Extension } from "@tiptap/core";
import {
    NodeSelection,
    Plugin,
    PluginKey,
    type Selection,
} from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type TableBlockDecoration = {
    from: number;
    kind: "cell" | "table";
    to: number;
};

const TABLE_BLOCK_SELECTED_CLASS = "table-block-selected";

/**
 * When a text selection includes a table *and* content outside it, the browser
 * paints `::selection` on every cell's text instead of treating the table as a
 * block. Mirror the image NodeView approach: decorate cells like CellSelection
 * and mark the table so CSS can hide native text highlights inside it.
 */
export function collectTableBlockDecorations(
    document_: ProseMirrorNode,
    selection: Selection
): TableBlockDecoration[] {
    if (selection.empty) return [];
    if (selection instanceof CellSelection) return [];
    if (selection instanceof NodeSelection) return [];

    const { from, to } = selection;
    const decorations: TableBlockDecoration[] = [];

    document_.descendants((node, pos) => {
        if (node.type.name !== "table") return true;
        if (!selectionOverlapsNode(from, to, pos, node.nodeSize)) return false;

        const tableEnd = pos + node.nodeSize;
        const extendsOutside = from < pos || to > tableEnd;
        if (!extendsOutside) return false;

        decorations.push({ from: pos, kind: "table", to: tableEnd });

        const fullyContained = from <= pos && to >= tableEnd;
        node.descendants((child, childPos) => {
            if (!isTableCell(child)) return true;
            const absoluteFrom = pos + 1 + childPos;
            const absoluteTo = absoluteFrom + child.nodeSize;
            if (
                fullyContained ||
                selectionOverlapsNode(from, to, absoluteFrom, child.nodeSize)
            ) {
                decorations.push({
                    from: absoluteFrom,
                    kind: "cell",
                    to: absoluteTo,
                });
            }
            return false;
        });

        return false;
    });

    return decorations;
}

export const TableBlockSelection = Extension.create({
    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey("tableBlockSelection"),
                props: {
                    decorations(state) {
                        const ranges = collectTableBlockDecorations(
                            state.doc,
                            state.selection
                        );
                        if (ranges.length === 0) return null;

                        return DecorationSet.create(
                            state.doc,
                            ranges.map((range) =>
                                Decoration.node(range.from, range.to, {
                                    class:
                                        range.kind === "table"
                                            ? TABLE_BLOCK_SELECTED_CLASS
                                            : "selectedCell",
                                })
                            )
                        );
                    },
                },
            }),
        ];
    },

    name: "tableBlockSelection",
});

function isTableCell(node: ProseMirrorNode): boolean {
    const role = node.type.spec.tableRole;
    return role === "cell" || role === "header_cell";
}

function selectionOverlapsNode(
    from: number,
    to: number,
    pos: number,
    nodeSize: number
): boolean {
    return from < pos + nodeSize && to > pos;
}
