const EMPTY_HTML_VALUES = new Set([
    "",
    "<p></p>",
    "<p><br/></p>",
    "<p><br></p>",
]);

const HTML_CONTENT_PATTERN = /<\/?[a-z][\s\S]*>/i;

export function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

export function isHtmlContent(value: string): boolean {
    return HTML_CONTENT_PATTERN.test(value);
}

export function isRichTextWithinLimit(
    value: string,
    maxLength: number
): boolean {
    return richTextLength(value) <= maxLength;
}

export function normalizeEditorContent(value: string): string {
    const trimmed = value.trim();
    if (EMPTY_HTML_VALUES.has(trimmed)) return "";
    return trimmed;
}

export function richTextLength(value: string): number {
    return normalizeEditorContent(value).length;
}

/** Converts editor HTML (or legacy plain text) into clipboard-friendly plain text. */
export function richTextToPlainText(value: string): string {
    const normalized = normalizeEditorContent(value);
    if (!normalized) return "";
    if (!isHtmlContent(normalized)) return normalized;

    const withBreaks = normalized
        .replaceAll(/<br\s*\/?>/gi, "\n")
        .replaceAll(/<\/(td|th)>/gi, "\t")
        .replaceAll(/<\/(p|h[1-6]|blockquote|pre|li|div|tr)>/gi, "\n")
        .replaceAll(/<img\b[^>]*>/gi, "")
        .replaceAll(/<[^>]+>/g, "");

    return decodeHtmlEntities(withBreaks)
        .replaceAll("\r\n", "\n")
        .replaceAll(/[^\S\n\t]+/g, " ")
        .replaceAll(/ *\t */g, "\t")
        .replaceAll("\n\t", "\t")
        .replaceAll("\t\n", "\n")
        .replaceAll(/ *\n */g, "\n")
        .replaceAll(/\n{3,}/g, "\n\n")
        .trim();
}

export function toEditorContent(value: string): string {
    if (!value) return "";
    if (isHtmlContent(value)) return value;

    const paragraphs = value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    if (paragraphs.length === 0) return "";

    return paragraphs.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

function decodeHtmlEntities(value: string): string {
    return value
        .replaceAll("&nbsp;", " ")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&quot;", '"')
        .replaceAll("&#39;", "'")
        .replaceAll("&amp;", "&");
}
