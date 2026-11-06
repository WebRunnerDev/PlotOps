/**
 * GitHub reads the backfill needs (ADR 0035 «Auto-link»): an installation
 * token scoped to one repository, its open PRs and its branches. The App JWT
 * comes from `github-app-status/github-app.ts`.
 */

export type GithubBranch = { name: string };

export type GithubPullRequest = {
    body: null | string;
    headRef: string;
    htmlUrl: null | string;
    number: number;
    title: string;
};

const GITHUB_API = "https://api.github.com";

/** Open PRs: 3 pages × 100. Branches: 10 pages × 100. */
export const MAX_PULL_PAGES = 3;
export const MAX_BRANCH_PAGES = 10;
const PER_PAGE = 100;

/**
 * Installation access token for `owner/repo`, limited to that repository.
 * Null when the App is not installed there (404) or GitHub refuses.
 */
export async function createRepositoryToken(
    jwt: string,
    repository: { fullName: string; githubRepoId: number },
    fetchImpl: typeof fetch = fetch
): Promise<null | string> {
    const path = repoPath(repository.fullName);
    if (!path) return null;

    const installation = await fetchImpl(
        `${GITHUB_API}/repos/${path}/installation`,
        {
            headers: githubHeaders(jwt),
        }
    );
    if (!installation.ok) return null;
    const { id } = (await installation.json()) as { id?: unknown };
    if (typeof id !== "number") return null;

    const token = await fetchImpl(
        `${GITHUB_API}/app/installations/${id}/access_tokens`,
        {
            body: JSON.stringify({ repository_ids: [repository.githubRepoId] }),
            headers: githubHeaders(jwt),
            method: "POST",
        }
    );
    if (!token.ok) return null;
    const body = (await token.json()) as { token?: unknown };
    return typeof body.token === "string" ? body.token : null;
}

export async function listBranches(
    token: string,
    fullName: string,
    fetchImpl: typeof fetch = fetch
): Promise<GithubBranch[]> {
    const rows = await listPages(
        token,
        `branches?per_page=${PER_PAGE}`,
        fullName,
        MAX_BRANCH_PAGES,
        fetchImpl
    );
    return rows.flatMap((row) => {
        const name = (row as { name?: unknown }).name;
        return typeof name === "string" ? [{ name }] : [];
    });
}

export async function listOpenPullRequests(
    token: string,
    fullName: string,
    fetchImpl: typeof fetch = fetch
): Promise<GithubPullRequest[]> {
    const rows = await listPages(
        token,
        `pulls?state=open&per_page=${PER_PAGE}`,
        fullName,
        MAX_PULL_PAGES,
        fetchImpl
    );
    return rows.flatMap((row) => {
        const pr = row as {
            body?: unknown;
            head?: { ref?: unknown };
            html_url?: unknown;
            number?: unknown;
            title?: unknown;
        };
        if (typeof pr.number !== "number" || typeof pr.head?.ref !== "string") {
            return [];
        }
        return [
            {
                body: typeof pr.body === "string" ? pr.body : null,
                headRef: pr.head.ref,
                htmlUrl: typeof pr.html_url === "string" ? pr.html_url : null,
                number: pr.number,
                title: typeof pr.title === "string" ? pr.title : "",
            },
        ];
    });
}

function githubHeaders(bearer: string): Record<string, string> {
    return {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${bearer}`,
        "User-Agent": "PlotOps-github-backfill",
        "X-GitHub-Api-Version": "2022-11-28",
    };
}

/** Pages until a short page or `maxPages`; throws when GitHub refuses. */
async function listPages(
    token: string,
    resource: string,
    fullName: string,
    maxPages: number,
    fetchImpl: typeof fetch
): Promise<unknown[]> {
    const path = repoPath(fullName);
    if (!path) throw new Error("invalid_repository_name");

    const rows: unknown[] = [];
    for (let page = 1; page <= maxPages; page += 1) {
        const response = await fetchImpl(
            `${GITHUB_API}/repos/${path}/${resource}&page=${page}`,
            { headers: githubHeaders(token) }
        );
        if (!response.ok) throw new Error(`github_${response.status}`);
        const batch = (await response.json()) as unknown;
        if (!Array.isArray(batch)) throw new Error("github_unexpected_body");
        rows.push(...batch);
        if (batch.length < PER_PAGE) break;
    }
    return rows;
}

function repoPath(fullName: string): null | string {
    const [owner, repo, ...rest] = fullName.split("/");
    if (!owner || !repo || rest.length > 0) return null;
    return `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}
