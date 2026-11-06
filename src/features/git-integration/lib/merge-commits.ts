import type { GitCommit } from "@/features/git-integration/api/github-git-api";

/** A Task commit with the Repository it was found in. */
export type RepositoryCommit<R> = {
    commit: GitCommit;
    /** The Task's manually linked commit. */
    linked: boolean;
    repository: R;
};

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

/**
 * One commit list for a Task across its Repositories: deduped by SHA (the
 * first Repository listing it wins), newest first, undated last.
 */
export function mergeRepositoryCommits<R>(
    sources: ReadonlyArray<{
        commits: ReadonlyArray<GitCommit>;
        repository: R;
    }>,
    linkedCommitSha?: string
): RepositoryCommit<R>[] {
    const bySha = new Map<string, RepositoryCommit<R>>();
    for (const { commits, repository } of sources) {
        for (const commit of commits) {
            if (bySha.has(commit.sha)) continue;
            bySha.set(commit.sha, {
                commit,
                linked: Boolean(
                    linkedCommitSha && commit.sha.startsWith(linkedCommitSha)
                ),
                repository,
            });
        }
    }
    const time = (row: RepositoryCommit<R>) => {
        const value = row.commit.author.date
            ? Date.parse(row.commit.author.date)
            : Number.NaN;
        return Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value;
    };
    return [...bySha.values()].toSorted((a, b) => time(b) - time(a));
}
