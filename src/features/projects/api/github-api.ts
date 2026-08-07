import type {
    GitHubRepo,
    RepoCollaborator,
} from "@/features/projects/model/types";

const GITHUB_API = "https://api.github.com";

type RawCollaborator = {
    avatar_url?: string;
    email?: null | string;
    id: number;
    login: string;
};

type RawUser = {
    email?: null | string;
};

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

export async function fetchRepoCollaborators(
    owner: string,
    repo: string,
    accessToken: string
): Promise<RepoCollaborator[]> {
    const collaborators: RepoCollaborator[] = [];
    const seenIds = new Set<number>();
    let page = 1;

    while (page <= 5) {
        const query = new URLSearchParams({
            affiliation: "all",
            page: String(page),
            per_page: "100",
        });

        const response = await fetch(
            `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/collaborators?${query.toString()}`,
            {
                headers: githubHeaders(accessToken),
            }
        );

        if (!response.ok) {
            throw new GitHubApiError(
                `GitHub API error: ${response.statusText}`,
                response.status
            );
        }

        const batch = (await response.json()) as RawCollaborator[];

        for (const item of batch) {
            if (seenIds.has(item.id)) continue;
            seenIds.add(item.id);
            collaborators.push({
                avatarUrl: item.avatar_url ?? "",
                email: normalizeOptionalEmail(item.email),
                id: item.id,
                login: item.login,
            });
        }

        if (batch.length < 100) break;
        page += 1;
    }

    await Promise.all(
        collaborators.map(async (collaborator, index) => {
            if (collaborator.email) return;
            const email = await fetchPublicUserEmail(
                collaborator.login,
                accessToken
            );
            if (email) {
                collaborators[index] = { ...collaborator, email };
            }
        })
    );

    return collaborators;
}

export async function fetchUserRepos(
    accessToken: string
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
                headers: githubHeaders(accessToken),
            }
        );

        if (!response.ok) {
            throw new GitHubApiError(
                `GitHub API error: ${response.statusText}`,
                response.status
            );
        }

        if (page === 1) {
            const scopes = parseOAuthScopes(
                response.headers.get("x-oauth-scopes")
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

function assertRepoScope(scopes: string[]) {
    const hasRepoScope = scopes.some(
        (scope) => scope === "repo" || scope.startsWith("repo:")
    );

    if (!hasRepoScope) {
        throw new GitHubMissingRepoScopeError();
    }
}

async function fetchPublicUserEmail(
    login: string,
    accessToken: string
): Promise<null | string> {
    const response = await fetch(
        `${GITHUB_API}/users/${encodeURIComponent(login)}`,
        { headers: githubHeaders(accessToken) }
    );
    if (!response.ok) return null;
    const user = (await response.json()) as RawUser;
    return normalizeOptionalEmail(user.email);
}

function githubHeaders(accessToken: string) {
    return {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
    };
}

function normalizeOptionalEmail(
    email: null | string | undefined
): null | string {
    const trimmed = email?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : null;
}

function parseOAuthScopes(headerValue: null | string): string[] {
    if (!headerValue) return [];

    return headerValue
        .split(",")
        .map((scope) => scope.trim())
        .filter(Boolean);
}
