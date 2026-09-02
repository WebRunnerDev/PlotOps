import type { User } from "@supabase/supabase-js";

import { fetchGitHubAuthenticatedUser } from "@/features/auth/lib/fetch-github-authenticated-user";
import { githubLoginFromUser } from "@/features/auth/lib/user-display";

export type GitHubProfileFields = {
    github_id: null | number;
    github_login: string;
};

type GitHubIdentityRow = {
    identity_data?: Record<string, unknown>;
    provider?: string;
    provider_id?: string;
};

/** GitHub login/id from Auth identity metadata (no network). */
export function githubIdentityFromUser(user: User): {
    github_id: null | number;
    github_login: null | string;
} {
    const identity = user.identities?.find(
        (row) => row.provider === "github"
    ) as GitHubIdentityRow | undefined;

    const loginFromIdentity = readGitHubLoginFromIdentityData(
        identity?.identity_data
    );
    const login = loginFromIdentity ?? githubLoginFromUser(user);

    const idSource =
        identity?.provider_id ??
        (typeof identity?.identity_data?.sub === "string"
            ? identity.identity_data.sub
            : null);
    const github_id = parseGitHubId(idSource);

    return {
        github_id,
        github_login: login,
    };
}

/** Whether the Auth user has a linked GitHub identity. */
export function hasGitHubIdentity(user: User): boolean {
    const provider = user.app_metadata?.provider;
    const providers = user.app_metadata?.providers ?? [];
    if (provider === "github" || providers.includes("github")) {
        return true;
    }
    return Boolean(
        user.identities?.some((identity) => identity.provider === "github")
    );
}

/**
 * Resolves canonical GitHub fields for profile sync.
 * Prefers GET /user when a token is available; falls back to Auth identity.
 */
export async function resolveGitHubProfileFields(
    user: User,
    githubAccessToken?: null | string,
    signal?: AbortSignal
): Promise<GitHubProfileFields | null> {
    if (!hasGitHubIdentity(user)) return null;

    if (githubAccessToken) {
        const fromApi = await fetchGitHubAuthenticatedUser(
            githubAccessToken,
            signal
        );
        if (fromApi) {
            return {
                github_id: fromApi.id,
                github_login: fromApi.login,
            };
        }
    }

    const fromIdentity = githubIdentityFromUser(user);
    if (fromIdentity.github_login && fromIdentity.github_id != undefined) {
        return {
            github_id: fromIdentity.github_id,
            github_login: fromIdentity.github_login,
        };
    }

    if (fromIdentity.github_login) {
        return {
            github_id: fromIdentity.github_id,
            github_login: fromIdentity.github_login,
        };
    }

    return null;
}

/** ADR 0026: sync username only when empty or still mirrors prior github_login. */
export function shouldSyncUsernameFromGitHub(input: {
    existingUsername: null | string;
    newGitHubLogin: string;
    previousGitHubLogin: null | string;
}): boolean {
    const username = input.existingUsername?.trim() ?? "";
    if (!username) return true;

    const previous = input.previousGitHubLogin?.trim().toLowerCase() ?? "";
    if (previous && username.toLowerCase() === previous) return true;

    return false;
}

function parseGitHubId(value: null | string | undefined): null | number {
    if (!value) return null;
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) ? parsed : null;
}

function readGitHubLoginFromIdentityData(
    data: Record<string, unknown> | undefined
): null | string {
    if (!data) return null;

    for (const key of ["user_name", "preferred_username", "login"] as const) {
        const value = data[key];
        if (typeof value !== "string") continue;
        const trimmed = value.trim();
        if (trimmed) return trimmed;
    }

    return null;
}
