const GITHUB_API = "https://api.github.com";
const PR_FILES_PAGE_SIZE = 100;
const PR_FILES_MAX_PAGES = 30;

const GITHUB_HEADERS = (token: string) => ({
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
});

export type CreatePullRequestInput = {
    base: string;
    body?: string;
    draft?: boolean;
    head: string;
    repoFullName: string;
    title: string;
    token: string;
};

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

export type GitHubWriteErrorKind =
    | "auth"
    | "conflict"
    | "forbidden"
    | "not_found"
    | "rate_limit"
    | "unknown"
    | "validation";

export type GitMergeMethod = "merge" | "rebase" | "squash";

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
    /** Null while GitHub is still computing mergeability. */
    mergeable: boolean | null;
    merged_at: null | string;
    number: number;
    state: "closed" | "open";
    title: string;
    updated_at: string;
    url: string;
};

export type MergePullRequestInput = {
    commitTitle?: string;
    mergeMethod: GitMergeMethod;
    prNumber: number;
    repoFullName: string;
    token: string;
};

export type MergePullRequestResult = {
    merged: boolean;
    message: string;
    sha: string;
};

export type PullRequestFilesResult = {
    files: GitPrFile[];
    /** True when GitHub still had more pages after `PR_FILES_MAX_PAGES`. */
    truncated: boolean;
};

type GithubFetchOptions = {
    body?: unknown;
    method?: string;
    parameters?: Record<string, string>;
    signal?: AbortSignal;
};

type RawPrPayload = {
    body: null | string;
    created_at: string;
    draft: boolean;
    head: { ref: string };
    html_url: string;
    mergeable?: boolean | null;
    merged_at: null | string;
    number: number;
    state: string;
    title: string;
    updated_at: string;
};

export class GitHubApiError extends Error {
    readonly status: number;

    constructor(status: number, path: string) {
        super(`GitHub API ${status}: ${path}`);
        this.name = "GitHubApiError";
        this.status = status;
    }
}

/** Open a PR: `head` into `base`. */
export async function createPullRequest(
    input: CreatePullRequestInput
): Promise<GitPullRequest> {
    const pr = await githubFetch<RawPrPayload>(
        `/repos/${input.repoFullName}/pulls`,
        input.token,
        {
            body: {
                base: input.base,
                ...(input.body === undefined ? {} : { body: input.body }),
                draft: input.draft ?? false,
                head: input.head,
                title: input.title,
            },
            method: "POST",
        }
    );

    return mapPullRequest(pr);
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
        { parameters: { per_page: String(perPage), sha: branchName } }
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
    const [owner] = repoFullName.split("/");
    const raw = await githubFetch<RawPrPayload[]>(
        `/repos/${repoFullName}/pulls`,
        token,
        {
            parameters: {
                head: `${owner}:${branchName}`,
                per_page: "10",
                state: "all",
            },
        }
    );

    return raw.map((pr) => mapPullRequest(pr));
}

/** Single pull request by number. */
export async function fetchPullRequest(
    repoFullName: string,
    prNumber: number,
    token: string,
    signal?: AbortSignal
): Promise<GitPullRequest> {
    const pr = await githubFetch<RawPrPayload>(
        `/repos/${repoFullName}/pulls/${prNumber}`,
        token,
        { signal }
    );

    return mapPullRequest(pr);
}

/** Changed files (with unified diff patches) for a PR — paginated. */
export async function fetchPullRequestFiles(
    repoFullName: string,
    prNumber: number,
    token: string
): Promise<PullRequestFilesResult> {
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
    let truncated = false;
    for (let page = 1; page <= PR_FILES_MAX_PAGES; page += 1) {
        const raw = await githubFetch<RawFile[]>(
            `/repos/${repoFullName}/pulls/${prNumber}/files`,
            token,
            {
                parameters: {
                    page: String(page),
                    per_page: String(PR_FILES_PAGE_SIZE),
                },
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
        if (page === PR_FILES_MAX_PAGES) {
            truncated = true;
        }
    }

    return { files, truncated };
}

export function gitHubWriteErrorKind(error: unknown): GitHubWriteErrorKind {
    if (!isGitHubApiError(error)) return "unknown";
    switch (error.status) {
        case 401: {
            return "auth";
        }
        case 403: {
            return "forbidden";
        }
        case 404: {
            return "not_found";
        }
        case 405:
        case 409: {
            return "conflict";
        }
        case 422: {
            return "validation";
        }
        case 429: {
            return "rate_limit";
        }
        default: {
            return "unknown";
        }
    }
}

export function isGitHubApiError(error: unknown): error is GitHubApiError {
    return error instanceof GitHubApiError;
}

/** Merge an open PR (GitHub enforces mergeability / branch protection). */
export async function mergePullRequest(
    input: MergePullRequestInput
): Promise<MergePullRequestResult> {
    return githubFetch<MergePullRequestResult>(
        `/repos/${input.repoFullName}/pulls/${input.prNumber}/merge`,
        input.token,
        {
            body: {
                ...(input.commitTitle === undefined
                    ? {}
                    : { commit_title: input.commitTitle }),
                merge_method: input.mergeMethod,
            },
            method: "PUT",
        }
    );
}

async function githubFetch<T>(
    path: string,
    token: string,
    options?: GithubFetchOptions
): Promise<T> {
    const url = new URL(`${GITHUB_API}${path}`);
    if (options?.parameters) {
        for (const [key, value] of Object.entries(options.parameters)) {
            url.searchParams.set(key, value);
        }
    }

    const method = options?.method ?? "GET";
    const headers: Record<string, string> = { ...GITHUB_HEADERS(token) };
    let body: string | undefined;
    if (options?.body !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(options.body);
    }

    const response = await fetch(url.toString(), {
        body,
        headers,
        method,
        signal: options?.signal,
    });

    if (!response.ok) {
        throw new GitHubApiError(response.status, path);
    }

    if (response.status === 204) {
        return undefined as T;
    }

    return response.json() as Promise<T>;
}

function mapPullRequest(pr: RawPrPayload): GitPullRequest {
    return {
        body: pr.body,
        created_at: pr.created_at,
        draft: pr.draft,
        head_ref: pr.head.ref,
        mergeable: pr.mergeable === undefined ? null : pr.mergeable,
        merged_at: pr.merged_at,
        number: pr.number,
        state: pr.state as GitPullRequest["state"],
        title: pr.title,
        updated_at: pr.updated_at,
        url: pr.html_url,
    };
}
