import { textReferencesTaskKey } from "@/features/git-integration/lib/extract-task-key";

const GITHUB_API = "https://api.github.com";
const PR_COMMITS_PAGE_SIZE = 100;
const PR_COMMITS_MAX_PAGES = 10;
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

export type PullRequestCommitsResult = {
    commits: GitCommit[];
    /** True when GitHub still had more pages after `PR_COMMITS_MAX_PAGES`. */
    truncated: boolean;
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

type RawCommitPayload = {
    author: null | { avatar_url: string; login: string };
    commit: {
        author: null | { date: string; name: string };
        message: string;
    };
    html_url: string;
    sha: string;
};

type RawPrFilePayload = {
    additions: number;
    blob_url: string;
    deletions: number;
    filename: string;
    patch?: string;
    previous_filename?: string;
    status: string;
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
    const raw = await githubFetch<RawCommitPayload[]>(
        `/repos/${repoFullName}/commits`,
        token,
        { parameters: { per_page: String(perPage), sha: branchName } }
    );

    return raw.map((commit) => mapCommit(commit));
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

/** Single commit by SHA (full or abbreviated). */
export async function fetchCommitBySha(
    repoFullName: string,
    sha: string,
    token: string,
    signal?: AbortSignal
): Promise<GitCommit> {
    const raw = await githubFetch<RawCommitPayload>(
        `/repos/${repoFullName}/commits/${encodeURIComponent(sha)}`,
        token,
        { signal }
    );

    return mapCommit(raw);
}

/** Changed files (with patches) for a single commit. */
export async function fetchCommitFiles(
    repoFullName: string,
    sha: string,
    token: string,
    signal?: AbortSignal
): Promise<PullRequestFilesResult> {
    type RawCommitWithFiles = RawCommitPayload & {
        files?: RawPrFilePayload[];
    };

    const raw = await githubFetch<RawCommitWithFiles>(
        `/repos/${repoFullName}/commits/${encodeURIComponent(sha)}`,
        token,
        { signal }
    );

    return {
        files: (raw.files ?? []).map((file) => mapPrFile(file)),
        truncated: false,
    };
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

/** Commits on a pull request — paginated. */
export async function fetchPullRequestCommits(
    repoFullName: string,
    prNumber: number,
    token: string
): Promise<PullRequestCommitsResult> {
    const commits: GitCommit[] = [];
    let truncated = false;
    for (let page = 1; page <= PR_COMMITS_MAX_PAGES; page += 1) {
        const raw = await githubFetch<RawCommitPayload[]>(
            `/repos/${repoFullName}/pulls/${prNumber}/commits`,
            token,
            {
                parameters: {
                    page: String(page),
                    per_page: String(PR_COMMITS_PAGE_SIZE),
                },
            }
        );

        for (const commit of raw) {
            commits.push(mapCommit(commit));
        }

        if (raw.length < PR_COMMITS_PAGE_SIZE) break;
        if (page === PR_COMMITS_MAX_PAGES) {
            truncated = true;
        }
    }

    return { commits, truncated };
}

/** Changed files (with unified diff patches) for a PR — paginated. */
export async function fetchPullRequestFiles(
    repoFullName: string,
    prNumber: number,
    token: string
): Promise<PullRequestFilesResult> {
    const files: GitPrFile[] = [];
    let truncated = false;
    for (let page = 1; page <= PR_FILES_MAX_PAGES; page += 1) {
        const raw = await githubFetch<RawPrFilePayload[]>(
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
            files.push(mapPrFile(f));
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

/**
 * Commits whose message mentions a task key (Jira-style smart commits).
 * Uses GitHub commit search — requires auth; rate-limited separately from REST.
 */
export async function searchCommitsByTaskKey(
    repoFullName: string,
    taskKey: string,
    token: string,
    perPage = 20
): Promise<GitCommit[]> {
    type SearchResponse = { items: RawCommitPayload[] };

    const q = `repo:${repoFullName} ${taskKey}`;
    const raw = await githubFetch<SearchResponse>("/search/commits", token, {
        parameters: { per_page: String(perPage), q },
    });

    return raw.items
        .map((commit) => mapCommit(commit))
        .filter((commit) => textReferencesTaskKey(commit.message, taskKey));
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

function mapCommit(raw: RawCommitPayload): GitCommit {
    return {
        author: {
            avatar_url: raw.author?.avatar_url ?? null,
            date: raw.commit.author?.date ?? null,
            login: raw.author?.login ?? null,
            name: raw.commit.author?.name ?? null,
        },
        message: raw.commit.message.split("\n")[0] ?? raw.commit.message,
        sha: raw.sha,
        url: raw.html_url,
    };
}

function mapPrFile(raw: RawPrFilePayload): GitPrFile {
    return {
        additions: raw.additions,
        blob_url: raw.blob_url,
        deletions: raw.deletions,
        filename: raw.filename,
        patch: raw.patch,
        previous_filename: raw.previous_filename,
        status: raw.status,
    };
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
