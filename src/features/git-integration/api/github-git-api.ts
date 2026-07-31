const GITHUB_API = "https://api.github.com";
const PR_FILES_PAGE_SIZE = 100;
const PR_FILES_MAX_PAGES = 30;

const GITHUB_HEADERS = (token: string) => ({
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
});

export type GitCommit = {
    author: {
        avatar_url: null | string;
        date: null | string;
        login: null | string;
        name: null | string;
    };
    message: string;
    sha: string;
    url: string;
};

export type GitPrFile = {
    additions: number;
    blob_url: string;
    deletions: number;
    filename: string;
    patch: string | undefined;
    previous_filename: string | undefined;
    status: string;
};

export type GitPullRequest = {
    body: null | string;
    created_at: string;
    draft: boolean;
    head_ref: string;
    merged_at: null | string;
    number: number;
    state: "closed" | "open";
    title: string;
    updated_at: string;
    url: string;
};

export class GitHubApiError extends Error {
    readonly status: number;

    constructor(status: number, path: string) {
        super(`GitHub API ${status}: ${path}`);
        this.name = "GitHubApiError";
        this.status = status;
    }
}

/** Last N commits on a branch (default 20). */
export async function fetchBranchCommits(
    repoFullName: string,
    branchName: string,
    token: string,
    perPage = 20
): Promise<GitCommit[]> {
    type RawCommit = {
        author: null | { avatar_url: string; login: string };
        commit: {
            author: null | { date: string; name: string };
            message: string;
        };
        html_url: string;
        sha: string;
    };

    const raw = await githubFetch<RawCommit[]>(
        `/repos/${repoFullName}/commits`,
        token,
        { per_page: String(perPage), sha: branchName }
    );

    return raw.map((c) => ({
        author: {
            avatar_url: c.author?.avatar_url ?? null,
            date: c.commit.author?.date ?? null,
            login: c.author?.login ?? null,
            name: c.commit.author?.name ?? null,
        },
        message: c.commit.message.split("\n")[0] ?? c.commit.message,
        sha: c.sha,
        url: c.html_url,
    }));
}

/** All PRs (open + closed) where head branch matches. */
export async function fetchBranchPullRequests(
    repoFullName: string,
    branchName: string,
    token: string
): Promise<GitPullRequest[]> {
    type RawPR = {
        body: null | string;
        created_at: string;
        draft: boolean;
        head: { ref: string };
        html_url: string;
        merged_at: null | string;
        number: number;
        state: string;
        title: string;
        updated_at: string;
    };

    const [owner] = repoFullName.split("/");
    const raw = await githubFetch<RawPR[]>(
        `/repos/${repoFullName}/pulls`,
        token,
        {
            head: `${owner}:${branchName}`,
            per_page: "10",
            state: "all",
        }
    );

    return raw.map((pr) => ({
        body: pr.body,
        created_at: pr.created_at,
        draft: pr.draft,
        head_ref: pr.head.ref,
        merged_at: pr.merged_at,
        number: pr.number,
        state: pr.state as GitPullRequest["state"],
        title: pr.title,
        updated_at: pr.updated_at,
        url: pr.html_url,
    }));
}

/** Single pull request by number. */
export async function fetchPullRequest(
    repoFullName: string,
    prNumber: number,
    token: string
): Promise<GitPullRequest> {
    type RawPR = {
        body: null | string;
        created_at: string;
        draft: boolean;
        head: { ref: string };
        html_url: string;
        merged_at: null | string;
        number: number;
        state: string;
        title: string;
        updated_at: string;
    };

    const pr = await githubFetch<RawPR>(
        `/repos/${repoFullName}/pulls/${prNumber}`,
        token
    );

    return {
        body: pr.body,
        created_at: pr.created_at,
        draft: pr.draft,
        head_ref: pr.head.ref,
        merged_at: pr.merged_at,
        number: pr.number,
        state: pr.state as GitPullRequest["state"],
        title: pr.title,
        updated_at: pr.updated_at,
        url: pr.html_url,
    };
}

/** Changed files (with unified diff patches) for a PR — paginated. */
export async function fetchPullRequestFiles(
    repoFullName: string,
    prNumber: number,
    token: string
): Promise<GitPrFile[]> {
    type RawFile = {
        additions: number;
        blob_url: string;
        deletions: number;
        filename: string;
        patch?: string;
        previous_filename?: string;
        status: string;
    };

    const files: GitPrFile[] = [];
    for (let page = 1; page <= PR_FILES_MAX_PAGES; page += 1) {
        const raw = await githubFetch<RawFile[]>(
            `/repos/${repoFullName}/pulls/${prNumber}/files`,
            token,
            {
                page: String(page),
                per_page: String(PR_FILES_PAGE_SIZE),
            }
        );

        for (const f of raw) {
            files.push({
                additions: f.additions,
                blob_url: f.blob_url,
                deletions: f.deletions,
                filename: f.filename,
                patch: f.patch,
                previous_filename: f.previous_filename,
                status: f.status,
            });
        }

        if (raw.length < PR_FILES_PAGE_SIZE) break;
    }

    return files;
}

export function isGitHubApiError(error: unknown): error is GitHubApiError {
    return error instanceof GitHubApiError;
}

async function githubFetch<T>(
    path: string,
    token: string,
    parameters?: Record<string, string>
): Promise<T> {
    const url = new URL(`${GITHUB_API}${path}`);
    if (parameters) {
        for (const [key, value] of Object.entries(parameters)) {
            url.searchParams.set(key, value);
        }
    }

    const response = await fetch(url.toString(), {
        headers: GITHUB_HEADERS(token),
    });

    if (!response.ok) {
        throw new GitHubApiError(response.status, path);
    }

    return response.json() as Promise<T>;
}
