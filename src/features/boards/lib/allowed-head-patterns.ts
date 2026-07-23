/** Simple glob match: `*` → any run of characters. Empty patterns = allow all. */
export function matchesAllowedHeadPatterns(
    branchName: string,
    patterns: string[]
): boolean {
    if (patterns.length === 0) return true;
    return patterns.some((pattern) => matchGlob(branchName, pattern.trim()));
}

export function parseAllowedHeadPatterns(raw: string): string[] {
    return raw
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function matchGlob(value: string, pattern: string): boolean {
    if (!pattern) return false;
    const escaped = pattern
        .replaceAll(/[.+^${}()|[\]\\]/g, String.raw`\$&`)
        .replaceAll("*", ".*");
    return new RegExp(`^${escaped}$`).test(value);
}
