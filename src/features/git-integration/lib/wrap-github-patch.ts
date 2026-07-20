import type { GitPrFile } from "@/features/git-integration/api/github-git-api";

/**
 * GitHub's `patch` is hunk-only (`@@ …`). @git-diff-view needs `---` / `+++`
 * headers or it reports "No hunks found" and renders an empty view.
 */
export function wrapGithubPatch(file: GitPrFile): string | undefined {
    if (!file.patch) return undefined;

    const oldPath =
        file.status === "added"
            ? "/dev/null"
            : `a/${file.previous_filename ?? file.filename}`;
    const newPath =
        file.status === "removed" ? "/dev/null" : `b/${file.filename}`;

    return `--- ${oldPath}\n+++ ${newPath}\n${file.patch}`;
}
