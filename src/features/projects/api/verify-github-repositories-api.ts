import type { ProjectRepositoryInput } from "@/features/projects/model/types";

import { getGitHubAccessToken } from "@/features/auth/model/github-token";
import { supabase } from "@/shared/api/supabase";

/**
 * - `no_access`: GitHub does not let the signed-in GitHub account reach the
 *   repository (or, for a public one, write to it), or no GitHub token;
 * - `unavailable`: GitHub or the Edge Function failed; trying again may help.
 */
export type GitHubRepositoryAccessReason = "no_access" | "unavailable";

type VerifyBody = { repositories?: unknown };

export class GitHubRepositoryAccessError extends Error {
    reason: GitHubRepositoryAccessReason;
    /** `owner/name` of each repository that was not verified. */
    repositories: string[];

    constructor(reason: GitHubRepositoryAccessReason, repositories: string[]) {
        super(
            reason === "no_access"
                ? `GitHub did not confirm access to ${repositories.join(", ")}`
                : `Could not verify access to ${repositories.join(", ")}`
        );
        this.name = "GitHubRepositoryAccessError";
        this.reason = reason;
        this.repositories = repositories;
    }
}

/**
 * Why linking failed for lack of verified GitHub access, or null for any other
 * error. Covers the Edge Function's answer and Postgres' own refusal (hint
 * `github_repository_unverified`), e.g. when the verification expired.
 */
export function githubRepositoryAccessReason(
    error: unknown
): GitHubRepositoryAccessReason | null {
    if (error instanceof GitHubRepositoryAccessError) return error.reason;
    if (
        typeof error === "object" &&
        error !== null &&
        (error as { hint?: unknown }).hint === "github_repository_unverified"
    ) {
        return "no_access";
    }
    return null;
}

/** `github_repo_id` → status; ids missing from the answer stay unverified. */
export function parseVerifyStatuses(
    body: null | undefined | VerifyBody
): Map<number, string> {
    const statuses = new Map<number, string>();
    if (!Array.isArray(body?.repositories)) return statuses;
    for (const item of body.repositories as unknown[]) {
        if (typeof item !== "object" || item === null) continue;
        const { id, status } = item as { id?: unknown; status?: unknown };
        if (typeof id === "number" && typeof status === "string") {
            statuses.set(id, status);
        }
    }
    return statuses;
}

/**
 * Has GitHub confirm, with the signed-in user's own GitHub token, that they
 * can reach each repository (`verify-github-repositories`, BUG-163). Postgres
 * refuses to link a Repository without that recent confirmation, so call this
 * right before linking. Throws `GitHubRepositoryAccessError` unless every
 * repository is verified.
 */
export async function verifyGitHubRepositories(
    repositories: readonly Pick<
        ProjectRepositoryInput,
        "github_full_name" | "github_repo_id"
    >[]
): Promise<void> {
    if (repositories.length === 0) return;
    const names = repositories.map((repo) => repo.github_full_name);

    const githubToken = getGitHubAccessToken();
    if (!githubToken) {
        throw new GitHubRepositoryAccessError("no_access", names);
    }

    const { data, error } = await supabase.functions.invoke<VerifyBody>(
        "verify-github-repositories",
        {
            body: {
                githubToken,
                repositories: repositories.map((repo) => ({
                    fullName: repo.github_full_name,
                    id: repo.github_repo_id,
                })),
            },
        }
    );
    if (error) throw new GitHubRepositoryAccessError("unavailable", names);

    const statuses = parseVerifyStatuses(data);
    const failed = repositories.filter(
        (repo) => statuses.get(repo.github_repo_id) !== "verified"
    );
    if (failed.length === 0) return;

    throw new GitHubRepositoryAccessError(
        failed.some(
            (repo) => statuses.get(repo.github_repo_id) === "unavailable"
        )
            ? "unavailable"
            : "no_access",
        failed.map((repo) => repo.github_full_name)
    );
}
