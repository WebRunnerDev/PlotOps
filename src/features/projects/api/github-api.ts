import type { GitHubRepo } from "@/features/projects/model/types";

const GITHUB_API = "https://api.github.com";

const REPO_QUERY = new URLSearchParams({
    affiliation: "owner,collaborator,organization_member",
    per_page: "100",
    sort: "updated",
    visibility: "all",
});

export class GitHubApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "GitHubApiError";
        this.status = status;
    }
}

export class GitHubMissingRepoScopeError extends Error {
    constructor() {
        super("GitHub token is missing the repo scope");
        this.name = "GitHubMissingRepoScopeError";
    }
}

function parseOAuthScopes(headerValue: null | string): string[] {
    if (!headerValue) return [];

    return headerValue
        .split(",")
        .map((scope) => scope.trim())
        .filter(Boolean);
}

function assertRepoScope(scopes: string[]) {
    const hasRepoScope = scopes.some(
        (scope) => scope === "repo" || scope.startsWith("repo:"),
    );

    if (!hasRepoScope) {
        throw new GitHubMissingRepoScopeError();
    }
}

export async function fetchUserRepos(
    accessToken: string,
): Promise<GitHubRepo[]> {
    const repos: GitHubRepo[] = [];
    const seenRepoIds = new Set<number>();
    let page = 1;

    while (page <= 5) {
        const query = new URLSearchParams(REPO_QUERY);
        query.set("page", String(page));

        const response = await fetch(
            `${GITHUB_API}/user/repos?${query.toString()}`,
            {
                headers: {
                    Accept: "application/vnd.github+json",
                    Authorization: `Bearer ${accessToken}`,
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            },
        );

        if (!response.ok) {
            throw new GitHubApiError(
                `GitHub API error: ${response.statusText}`,
                response.status,
            );
        }

        if (page === 1) {
            const scopes = parseOAuthScopes(
                response.headers.get("x-oauth-scopes"),
            );

            if (scopes.length > 0) {
                assertRepoScope(scopes);
            }
        }

        const batch = (await response.json()) as GitHubRepo[];

        for (const repo of batch) {
            if (seenRepoIds.has(repo.id)) continue;
            seenRepoIds.add(repo.id);
            repos.push(repo);
        }

        if (batch.length < 100) break;
        page += 1;
    }

    return repos;
}
