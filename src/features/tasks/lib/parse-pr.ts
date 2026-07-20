/**
 * Parse a PR number from free text: `42`, `#42`, or a GitHub pull URL.
 */
export function parsePrNumber(raw: string): number | undefined {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;

    const urlMatch = /github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/i.exec(trimmed);
    if (urlMatch?.[1]) {
        return Number(urlMatch[1]);
    }

    const hashMatch = /#(\d+)\s*$/.exec(trimmed);
    if (hashMatch?.[1]) {
        return Number(hashMatch[1]);
    }

    if (/^\d+$/.test(trimmed)) {
        return Number(trimmed);
    }

    return undefined;
}
