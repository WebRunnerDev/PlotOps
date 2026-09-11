/**
 * Inline-formatting bubble (Bold/Italic/…) that appears on a text selection.
 *
 * Viewed comments and archived descriptions use a read-only editor so people
 * can still copy text. The bubble is edit-only — opening it on a selection
 * there looks like the comment is editable.
 */
export function shouldShowSelectionBubble(options: {
    editable: boolean;
    hasTextSelection: boolean;
}): boolean {
    return options.editable && options.hasTextSelection;
}
