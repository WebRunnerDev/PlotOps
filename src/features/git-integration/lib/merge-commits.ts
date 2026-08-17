import type { GitCommit } from "@/features/git-integration/api/github-git-api";

/** Merge commit lists by SHA; earlier lists win for duplicate SHAs. */
export function mergeCommitsBySha(
    ...lists: ReadonlyArray<ReadonlyArray<GitCommit>>
): GitCommit[] {
    const bySha = new Map<string, GitCommit>();

    for (const list of lists) {
        for (const commit of list) {
            if (!bySha.has(commit.sha)) {
                bySha.set(commit.sha, commit);
            }
        }
    }

    return [...bySha.values()];
}
