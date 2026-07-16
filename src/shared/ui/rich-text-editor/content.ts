const EMPTY_HTML_VALUES = new Set(["", "<p></p>", "<p><br></p>", "<p><br/></p>"]);

const HTML_CONTENT_PATTERN = /<\/?[a-z][\s\S]*>/i;

export function isHtmlContent(value: string): boolean {
    return HTML_CONTENT_PATTERN.test(value);
}

export function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
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

export function normalizeEditorContent(value: string): string {
    const trimmed = value.trim();
    if (EMPTY_HTML_VALUES.has(trimmed)) return "";
    return trimmed;
}
