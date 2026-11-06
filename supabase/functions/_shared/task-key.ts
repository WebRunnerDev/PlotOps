/**
 * Task key matching shared by the app and the Edge Functions (ADR 0035
 * «Auto-link»): commit lists in the drawer and the webhook / backfill find
 * keys the same way. Pure — runs in Deno, Node and the browser.
 */

/**
 * A task key such as `TASK-12`, `bug-5`: letters, a dash, digits. It must not
 * continue a word or number on either side, so `TASK-1-login`,
 * `user/foo-TASK-1` and `[TASK-1]` match, while `XTASK-1` reads as its own key
 * and `TASK-12` never yields `TASK-1`.
 */
const TASK_KEY_PATTERN = /(?<![A-Za-z0-9])([A-Za-z]+-\d+)(?!\d)/g;

/**
 * All task keys found in free text (branch name, PR title / body, commit
 * message). Case kept from the source; deduped case-insensitively (first
 * wins).
 */
export function extractTaskKeysFromText(text: string): string[] {
    const seen = new Set<string>();
    const keys: string[] = [];

    for (const match of text.matchAll(TASK_KEY_PATTERN)) {
        const key = match[1];
        if (!key) continue;
        const upper = key.toUpperCase();
        if (seen.has(upper)) continue;
        seen.add(upper);
        keys.push(key);
    }

    return keys;
}

/** Trim and strip `refs/heads/` / `origin/` prefixes. */
export function normalizeGitReference(raw: string): string {
    return raw
        .trim()
        .replace(/^refs\/heads\//i, "")
        .replace(/^origin\//i, "");
}

/** Whether `text` references the given task key (case-insensitive). */
export function textReferencesTaskKey(text: string, taskKey: string): boolean {
    const target = taskKey.trim().toUpperCase();
    if (!target) return false;

    return extractTaskKeysFromText(text).some(
        (key) => key.toUpperCase() === target
    );
}
