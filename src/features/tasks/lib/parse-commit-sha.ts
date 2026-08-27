const FULL_SHA = /^[0-9a-f]{40}$/i;
const SHORT_SHA = /^[0-9a-f]{7,39}$/i;

/**
 * Parse a commit SHA from free text: full/short hash or a GitHub commit URL.
 */
export function parseCommitSha(raw: string): string | undefined {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;

    const urlMatch =
        /github\.com\/[^/]+\/[^/]+\/commit\/([0-9a-f]{7,40})/i.exec(trimmed);
    if (urlMatch?.[1]) {
        return urlMatch[1].toLowerCase();
    }

    if (FULL_SHA.test(trimmed) || SHORT_SHA.test(trimmed)) {
        return trimmed.toLowerCase();
    }

    return undefined;
}
