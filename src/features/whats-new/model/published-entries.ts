import type { WhatsNewEntry, WhatsNewLocale } from "./releases";

/** Numeric SemVer compare on `MAJOR.MINOR.PATCH` (pre-release tags unused). */
export function compareVersions(a: string, b: string): number {
    const left = a.split(".").map(Number);
    const right = b.split(".").map(Number);

    for (let index = 0; index < 3; index += 1) {
        const difference = (left[index] ?? 0) - (right[index] ?? 0);
        if (difference !== 0) {
            return difference;
        }
    }

    return 0;
}

/** Latest release shown to users — what the "unseen" dot compares against. */
export function latestPublishedVersion(
    entries: readonly WhatsNewEntry[],
    currentVersion: string
): null | string {
    return (
        selectPublishedEntries(entries, currentVersion).find(
            (entry) => entry.version !== null
        )?.version ?? null
    );
}

export function resolveWhatsNewLocale(language: string): WhatsNewLocale {
    return language.startsWith("en") ? "en" : "ru";
}

/**
 * Entries visible in this build: pre-1.0 periods plus releases up to
 * `currentVersion`. A release written ahead of its release PR stays hidden.
 */
export function selectPublishedEntries(
    entries: readonly WhatsNewEntry[],
    currentVersion: string
): WhatsNewEntry[] {
    return entries.filter(
        (entry) =>
            entry.version === null ||
            compareVersions(entry.version, currentVersion) <= 0
    );
}
