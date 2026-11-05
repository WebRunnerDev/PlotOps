import { supabase } from "@/shared/api/supabase";

export type GithubAppInstallationStatus =
    "installed" | "not_installed" | "unknown";

export type GithubAppStatus = {
    /** False when the server has no GitHub App credentials. */
    configured: boolean;
    installUrl: null | string;
    /** Keyed by `project_repositories.id`. */
    statuses: Record<string, GithubAppInstallationStatus>;
};

type GithubAppStatusBody = {
    configured?: unknown;
    installUrl?: unknown;
    repositories?: unknown;
};

const STATUSES = new Set<string>(["installed", "not_installed", "unknown"]);

/**
 * GitHub App installation per Repository, via the `github-app-status` Edge
 * Function (the App JWT stays server-side). Throws on failure; callers treat
 * that as "status unavailable" and keep the page working.
 */
export async function fetchGithubAppStatus(
    projectId: string
): Promise<GithubAppStatus> {
    const { data, error } =
        await supabase.functions.invoke<GithubAppStatusBody>(
            "github-app-status",
            { body: { projectId } }
        );
    if (error) throw error;
    return parseGithubAppStatus(data);
}

export function parseGithubAppStatus(
    body: GithubAppStatusBody | null | undefined
): GithubAppStatus {
    const statuses: GithubAppStatus["statuses"] = {};
    if (Array.isArray(body?.repositories)) {
        for (const item of body.repositories as unknown[]) {
            if (typeof item !== "object" || item === null) continue;
            const { id, status } = item as { id?: unknown; status?: unknown };
            if (typeof id !== "string") continue;
            statuses[id] =
                typeof status === "string" && STATUSES.has(status)
                    ? (status as GithubAppInstallationStatus)
                    : "unknown";
        }
    }
    return {
        configured: body?.configured === true,
        installUrl:
            typeof body?.installUrl === "string" &&
            body.installUrl.startsWith("https://github.com/")
                ? body.installUrl
                : null,
        statuses,
    };
}
