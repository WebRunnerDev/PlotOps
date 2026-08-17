/** PlotOps task key pattern: `TASK-12`, `BUG-5`, `FEAT-42`. */
const TASK_KEY_PATTERN = /\b([A-Za-z]+-\d+)\b/g;

/** Extract a task key from a branch like `feature/TASK-12-login`. */
export function extractTaskKeyFromBranch(branchName: string): null | string {
    const normalized = branchName
        .trim()
        .replace(/^refs\/heads\//i, "")
        .replace(/^origin\//i, "");
    const match = /\/([A-Za-z]+-\d+)(?:-|$)/.exec(normalized);
    return match?.[1] ?? null;
}

/**
 * All task keys found in free text (commit message, branch name, PR title).
 * Case preserved from source; deduped case-insensitively (first wins).
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

/** Whether `text` references the given task key (case-insensitive). */
export function textReferencesTaskKey(text: string, taskKey: string): boolean {
    const target = taskKey.trim().toUpperCase();
    if (!target) return false;

    return extractTaskKeysFromText(text).some(
        (key) => key.toUpperCase() === target
    );
}
