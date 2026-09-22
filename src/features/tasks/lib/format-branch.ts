import type { TaskType } from "@/features/tasks/model/types";

/** Shared / base branches — not dedicated task branches. */
const SHARED_BRANCH_NAMES = new Set([
    "dev",
    "develop",
    "development",
    "main",
    "master",
    "prod",
    "production",
    "release",
    "stage",
    "staging",
]);

/** Shorten branch names for kanban card chrome. */
export function formatBranchName(branchName: string, maxLength = 22): string {
    if (branchName.length <= maxLength) {
        return branchName;
    }

    return `${branchName.slice(0, Math.max(1, maxLength - 1))}…`;
}

/**
 * Generate a git branch name from a task key and title.
 * - Tasks   → feature/TASK-1-short-slug
 * - Bugs    → fix/BUG-5-short-slug
 * - Stories → feature/STORY-12-short-slug
 * - Epics   → feature/EPIC-3-short-slug (Epics normally carry no branch)
 *
 * The slug is capped at 40 chars and non-ASCII is stripped to keep it
 * compatible with all git hosts.
 */
export function generateBranchName(
    key: string,
    title: string,
    type: TaskType
): string {
    const prefix = type === "bug" ? "fix" : "feature";
    const slug = title
        .toLowerCase()
        .replaceAll(/[^\da-z]+/g, "-")
        .replaceAll(/^-+|-+$/g, "")
        .slice(0, 40)
        .replaceAll(/-+$/g, "");

    return slug ? `${prefix}/${key}-${slug}` : `${prefix}/${key}`;
}

/**
 * True for long-lived integration branches (main, dev, …).
 * Linking these to a task is allowed but git history must be degraded.
 */
export function isSharedBranch(branchName: string): boolean {
    const name = normalizeBranchName(branchName).toLowerCase();
    if (SHARED_BRANCH_NAMES.has(name)) return true;
    return name.startsWith("release/");
}

/** Trim and strip common remotes/refs prefixes. */
export function normalizeBranchName(raw: string): string {
    return raw
        .trim()
        .replace(/^refs\/heads\//i, "")
        .replace(/^origin\//i, "");
}
