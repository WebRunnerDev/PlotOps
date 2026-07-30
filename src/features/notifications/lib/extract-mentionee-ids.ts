/**
 * Mentionee id extraction + new-only delta for Mention fan-out (ADR 0014).
 * Free-text `@Name` without a structured TipTap Mention node is ignored.
 */

const MENTION_SPAN_PATTERN = /<span\b[^>]*\bdata-type=(["'])mention\1[^>]*>/gi;

const DATA_ID_PATTERN = /\bdata-id=(["'])([^"']+)\1/i;

/**
 * Distinct Mentionee user ids from structured Mention nodes in HTML.
 * Attribute order on the span may vary; free-text @labels do not count.
 */
export function extractMentioneeIds(html: string): string[] {
    if (!html) return [];

    const ids: string[] = [];
    const seen = new Set<string>();

    for (const match of html.matchAll(MENTION_SPAN_PATTERN)) {
        const span = match[0];
        const idMatch = DATA_ID_PATTERN.exec(span);
        const id = idMatch?.[2]?.trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
    }

    return ids;
}

/**
 * Mentionee ids present in `nextHtml` that were not in `previousHtml`.
 * Unchanged Mentionees across an edit are excluded (no re-notify).
 */
export function newMentioneeIds(
    previousHtml: string,
    nextHtml: string
): string[] {
    const previous = new Set(extractMentioneeIds(previousHtml));
    return extractMentioneeIds(nextHtml).filter((id) => !previous.has(id));
}
