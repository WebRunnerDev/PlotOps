import {
    escapeHtml,
    normalizeEditorContent,
    richTextToPlainText,
} from "@/shared/ui/rich-text-editor/content";

/** HTML clipboard payload — keeps inline images for rich-text paste targets. */
export function formatTaskCopyHtml(title: string, description: string): string {
    const heading = title.trim();
    const body = normalizeEditorContent(description);
    if (!body) {
        return heading ? `<p>${escapeHtml(heading)}</p>` : "";
    }
    if (!heading) return body;
    return `<p><strong>${escapeHtml(heading)}</strong></p>${body}`;
}

/** Plain-text clipboard payload for a one-click copy of a task title and description. */
export function formatTaskCopyText(title: string, description: string): string {
    const heading = title.trim();
    const body = richTextToPlainText(description);
    if (!body) return heading;
    if (!heading) return body;
    return `${heading}\n\n${body}`;
}
