import type { Editor } from "@tiptap/core";

import { NodeSelection, TextSelection } from "@tiptap/pm/state";

/**
 * TipTap/ProseMirror boots (and `setContent`) with `Selection.atStart`. When the
 * first block is a selectable atom — e.g. an image — that becomes a
 * `NodeSelection`, so the image chrome appears as soon as the editor mounts
 * (task drawer open) even though the user never clicked it.
 *
 * Prefer a caret in the nearest textblock after the node. If none exists
 * (image-only doc), leave the NodeSelection alone — callers should still hide
 * image chrome while the editor is unfocused.
 */
export function clearBootNodeSelection(editor: Editor): boolean {
    const { doc, selection } = editor.state;
    if (!(selection instanceof NodeSelection)) return false;

    try {
        const near = TextSelection.near(doc.resolve(selection.to), 1);
        if (near instanceof NodeSelection) return false;
        if (near.from === selection.from && near.to === selection.to) {
            return false;
        }
        editor.view.dispatch(editor.state.tr.setSelection(near));
        return true;
    } catch {
        return false;
    }
}
