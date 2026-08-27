import type { Editor } from "@tiptap/core";

import { cellAround, CellSelection, selectedRect } from "@tiptap/pm/tables";

export type TableClipboardKind = "column" | "grid" | "row";

export async function copyTableColumn(editor: Editor): Promise<boolean> {
    if (!selectTableColumn(editor)) return false;
    return writeClipboard(editor);
}

export async function copyTableRow(editor: Editor): Promise<boolean> {
    if (!selectTableRow(editor)) return false;
    return writeClipboard(editor);
}

export function selectTableColumn(editor: Editor): boolean {
    const cell = resolveAnchorCell(editor);
    if (!cell) return false;
    editor.view.dispatch(
        editor.state.tr.setSelection(CellSelection.colSelection(cell))
    );
    return true;
}

export function selectTableRow(editor: Editor): boolean {
    const cell = resolveAnchorCell(editor);
    if (!cell) return false;
    editor.view.dispatch(
        editor.state.tr.setSelection(CellSelection.rowSelection(cell))
    );
    return true;
}

export function serializeTableCellsPlainText({
    cells,
    columnCount = 1,
    kind,
}: {
    cells: string[];
    columnCount?: number;
    kind: TableClipboardKind;
}): string {
    if (kind === "column") return cells.join("\n");
    if (kind === "row") return cells.join("\t");

    const width = Math.max(columnCount, 1);
    const rows: string[] = [];
    for (let index = 0; index < cells.length; index += width) {
        rows.push(cells.slice(index, index + width).join("\t"));
    }
    return rows.join("\n");
}

export function tableSelectionPlainText(editor: Editor): null | string {
    const { selection } = editor.state;
    if (!(selection instanceof CellSelection)) return null;

    const cells = collectCellTexts(selection);
    if (cells.length === 0) return null;
    if (selection.isColSelection()) {
        return serializeTableCellsPlainText({ cells, kind: "column" });
    }
    if (selection.isRowSelection()) {
        return serializeTableCellsPlainText({ cells, kind: "row" });
    }

    const rect = selectedRect(editor.state);
    return serializeTableCellsPlainText({
        cells,
        columnCount: Math.max(rect.right - rect.left, 1),
        kind: "grid",
    });
}

function collectCellTexts(selection: CellSelection): string[] {
    const cells: string[] = [];
    selection.forEachCell((node) => {
        cells.push(node.textContent);
    });
    return cells;
}

function resolveAnchorCell(editor: Editor) {
    const { selection } = editor.state;
    if (selection instanceof CellSelection) return selection.$anchorCell;
    return cellAround(selection.$from);
}

async function writeClipboard(editor: Editor): Promise<boolean> {
    editor.view.focus();
    if (typeof document !== "undefined" && document.execCommand("copy")) {
        return true;
    }

    const text = tableSelectionPlainText(editor);
    if (text === null) return false;
    await navigator.clipboard.writeText(text);
    return true;
}
