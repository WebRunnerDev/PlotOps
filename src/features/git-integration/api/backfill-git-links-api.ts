import { supabase } from "@/shared/api/supabase";

export type BackfillGitLinksResult = {
    /** False when the server has no GitHub App credentials. */
    configured: boolean;
    /** Tasks that got a new or updated Git link. */
    linked: number;
    /** Repositories GitHub could not be read for (App missing, outage). */
    unavailable: number;
};

type BackfillBody = {
    configured?: unknown;
    linked?: unknown;
    repositories?: unknown;
};

/**
 * Link open PRs and branches that carry a task key, via the `github-backfill`
 * Edge Function (ADR 0035 «Auto-link»). `repositoryId` limits it to one
 * Repository (just connected). Throws on failure.
 */
export async function backfillGitLinks(
    projectId: string,
    repositoryId?: string
): Promise<BackfillGitLinksResult> {
    const { data, error } = await supabase.functions.invoke<BackfillBody>(
        "github-backfill",
        { body: repositoryId ? { projectId, repositoryId } : { projectId } }
    );
    if (error) throw error;
    return parseBackfillGitLinks(data);
}

export function parseBackfillGitLinks(
    body: BackfillBody | null | undefined
): BackfillGitLinksResult {
    const repositories = Array.isArray(body?.repositories)
        ? (body.repositories as unknown[])
        : [];
    return {
        configured: body?.configured === true,
        linked:
            typeof body?.linked === "number" && body.linked > 0
                ? Math.floor(body.linked)
                : 0,
        unavailable: repositories.filter(
            (item) =>
                typeof item === "object" &&
                item !== null &&
                (item as { status?: unknown }).status !== "synced"
        ).length,
    };
}
