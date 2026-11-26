/**
 * Whether a GitHub token may link a repository (BUG-163). `GET /repos/{name}`
 * with the caller's own token, never the App's: the App can read every
 * repository it is installed on, which proves nothing about the caller.
 */

export type RepositoryAccess =
    | { reason: "no_access" | "unavailable"; status: "denied" }
    | { repository: VerifiedRepository; status: "verified" };

/** What GitHub reports about a repository the caller may link. */
export type VerifiedRepository = {
    defaultBranch: string;
    fullName: string;
    htmlUrl: string;
    id: number;
    isPrivate: boolean;
};

type GithubRepositoryBody = {
    default_branch?: unknown;
    full_name?: unknown;
    html_url?: unknown;
    id?: unknown;
    permissions?: {
        admin?: unknown;
        maintain?: unknown;
        push?: unknown;
    };
    private?: unknown;
};

const GITHUB_API = "https://api.github.com";

/**
 * - `verified`: GitHub answered with the same repository id, and the caller
 *   can see it as a private repository or can write to it as a public one;
 * - `no_access`: GitHub does not show it to this token (404, 403), the id is
 *   another repository's, or a public repository the caller only reads;
 * - `unavailable`: GitHub failed (rate limit, outage, network).
 *
 * Reading a public repository proves nothing — anyone can — so a public one
 * needs push, maintain or admin rights.
 */
export async function checkRepositoryAccess(
    token: string,
    repository: { fullName: string; id: number },
    fetchImpl: typeof fetch = fetch
): Promise<RepositoryAccess> {
    const [owner, name, ...rest] = repository.fullName.split("/");
    if (!owner || !name || rest.length > 0) {
        return { reason: "no_access", status: "denied" };
    }

    let response: Response;
    try {
        // A renamed repository redirects to its new name; fetch follows it.
        response = await fetchImpl(
            `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
            {
                headers: {
                    Accept: "application/vnd.github+json",
                    Authorization: `Bearer ${token}`,
                    "User-Agent": "PlotOps-verify-github-repositories",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            }
        );
    } catch {
        return { reason: "unavailable", status: "denied" };
    }

    if (response.status === 401) {
        return { reason: "no_access", status: "denied" };
    }
    if (response.status === 404 || response.status === 403) {
        // 403 is also GitHub's rate limit answer.
        return {
            reason:
                response.headers.get("x-ratelimit-remaining") === "0"
                    ? "unavailable"
                    : "no_access",
            status: "denied",
        };
    }
    if (!response.ok) return { reason: "unavailable", status: "denied" };

    let body: GithubRepositoryBody;
    try {
        body = (await response.json()) as GithubRepositoryBody;
    } catch {
        return { reason: "unavailable", status: "denied" };
    }

    if (
        body.id !== repository.id ||
        typeof body.full_name !== "string" ||
        typeof body.html_url !== "string" ||
        typeof body.private !== "boolean"
    ) {
        return { reason: "no_access", status: "denied" };
    }

    const permissions = body.permissions ?? {};
    const canWrite =
        permissions.push === true ||
        permissions.maintain === true ||
        permissions.admin === true;
    if (!body.private && !canWrite) {
        return { reason: "no_access", status: "denied" };
    }

    const defaultBranch =
        typeof body.default_branch === "string" && body.default_branch.trim()
            ? body.default_branch
            : "main";

    return {
        repository: {
            defaultBranch,
            fullName: body.full_name,
            htmlUrl: body.html_url,
            id: body.id,
            isPrivate: body.private,
        },
        status: "verified",
    };
}
