import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { z } from "zod";

import type {
    RateLimiter,
    RateLimitRule,
} from "../_shared/postgres-rate-limit.ts";

import {
    corsHeadersFor,
    type CorsPolicy,
    preflightResponse,
} from "../_shared/cors.ts";
import {
    jsonResponse,
    parseJsonBody,
    readBodyText,
    withErrorBoundary,
} from "../_shared/http.ts";
import { createAppJwt } from "../github-app-status/github-app.ts";
import { loadCandidateTasks } from "../github-webhook/git-links.ts";
import {
    syncCreatedBranch,
    syncOpenedPullRequest,
    type SyncResult,
} from "../github-webhook/sync.ts";
import {
    createRepositoryToken,
    listBranches,
    listOpenPullRequests,
} from "./github-repo-api.ts";
import { planBackfill } from "./plan-backfill.ts";

export const BACKFILL_MAX_BODY_BYTES = 1024;

/** Per signed-in user — «Refresh» in the drawer and Repository connect. */
export const BACKFILL_USER_RULE: RateLimitRule = {
    limit: 30,
    windowSec: 3600,
};

export const backfillRequestSchema = z.object({
    projectId: z.uuid(),
    /** Only this Repository (just connected); every one when absent. */
    repositoryId: z.uuid().optional(),
});

/**
 * - `synced`: open PRs and branches were read and replayed;
 * - `not_installed`: no installation token (App missing on that repository);
 * - `unavailable`: GitHub failed mid-way; nothing more was linked there.
 */
export type BackfillRepositoryStatus =
    "not_installed" | "synced" | "unavailable";

export type BackfillResponse = {
    /** False when the App credentials are not configured on the server. */
    configured: boolean;
    /** Tasks that got a new or updated Git link. */
    linked: number;
    repositories: { id: string; status: BackfillRepositoryStatus }[];
};

export type GithubBackfillDeps = {
    cors: CorsPolicy;
    /** Service-role client for the writes; `null` when env is missing. */
    createServiceClient: () => null | SupabaseClient;
    /** Caller-scoped client (RLS applies); `null` when env is missing. */
    createUserClient: (authHeader: string) => null | SupabaseClient;
    env: (name: string) => string | undefined;
    fetchImpl?: typeof fetch;
    nowSec?: () => number;
    rateLimiter: RateLimiter;
};

type RepositoryRow = {
    github_full_name: string;
    github_repo_id: number;
    id: string;
    project_id: string;
};

/**
 * `POST { projectId, repositoryId? }` → find open PRs and branches carrying a
 * task key on GitHub and link them by the webhook's auto-link rules (ADR 0035
 * «Auto-link»): no overwrite, no relink after a manual unlink. Editors only;
 * the App JWT and installation tokens never leave the function.
 */
export function createGithubBackfillHandler(
    deps: GithubBackfillDeps
): (request: Request) => Promise<Response> {
    const headersFor = (request: Request) =>
        corsHeadersFor(request.headers.get("Origin"), deps.cors);
    const fetchImpl = deps.fetchImpl ?? fetch;
    const nowSec = deps.nowSec ?? (() => Math.floor(Date.now() / 1000));

    return withErrorBoundary(async (request) => {
        const corsHeaders = headersFor(request);
        const json = (body: unknown, status = 200) =>
            jsonResponse(body, status, corsHeaders);

        if (request.method === "OPTIONS") {
            return preflightResponse(request, deps.cors);
        }
        if (request.method !== "POST") {
            return json({ error: "method_not_allowed" }, 405);
        }

        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return json({ error: "unauthorized" }, 401);
        }

        const rawBody = await readBodyText(request, BACKFILL_MAX_BODY_BYTES);
        if (!rawBody.ok) {
            return json({ error: rawBody.error }, rawBody.status);
        }
        const body = parseJsonBody(rawBody.text, backfillRequestSchema);
        if (!body.ok) {
            return json({ error: body.error }, body.status);
        }

        const userClient = deps.createUserClient(authHeader);
        const serviceClient = deps.createServiceClient();
        if (!userClient || !serviceClient) {
            console.error(JSON.stringify({ reason: "missing_supabase_env" }));
            return json({ error: "server_misconfigured" }, 500);
        }

        const {
            data: { user },
            error: userError,
        } = await userClient.auth.getUser();
        if (userError || !user) {
            return json({ error: "unauthorized" }, 401);
        }

        const limit = await deps.rateLimiter.check(
            `github-backfill:user:${user.id}`,
            BACKFILL_USER_RULE
        );
        if (!limit.allowed) {
            return json(
                { error: "rate_limited", retryAfterSec: limit.retryAfterSec },
                429
            );
        }

        const { projectId, repositoryId } = body.data;
        const { data: canEdit, error: canEditError } = await userClient.rpc(
            "can_edit_tasks",
            { project_uuid: projectId }
        );
        if (canEditError || canEdit !== true) {
            return json({ error: "forbidden" }, 403);
        }

        let query = userClient
            .from("project_repositories")
            .select("id, project_id, github_repo_id, github_full_name")
            .eq("project_id", projectId);
        if (repositoryId) query = query.eq("id", repositoryId);
        const { data, error } = await query;
        if (error) {
            console.error(
                JSON.stringify({
                    error: error.message,
                    reason: "repositories_load_failed",
                })
            );
            return json({ error: "repositories_load_failed" }, 500);
        }
        const rows = (data ?? []) as RepositoryRow[];

        const appId = deps.env("GITHUB_APP_ID")?.trim();
        const privateKey = deps.env("GITHUB_APP_PRIVATE_KEY")?.trim();
        if (!appId || !privateKey) {
            return json({
                configured: false,
                linked: 0,
                repositories: rows.map((row) => ({
                    id: row.id,
                    status: "unavailable" as const,
                })),
            } satisfies BackfillResponse);
        }

        const jwt = await createAppJwt(appId, privateKey, nowSec());
        const log = (fields: Record<string, unknown>) =>
            console.log(
                JSON.stringify({ projectId, source: "backfill", ...fields })
            );

        let linked = 0;
        const repositories: BackfillResponse["repositories"] = [];

        // One Repository at a time keeps GitHub and the DB load predictable.
        for (const row of rows) {
            const repository = { id: row.id, project_id: row.project_id };
            try {
                const token = await createRepositoryToken(
                    jwt,
                    {
                        fullName: row.github_full_name,
                        githubRepoId: row.github_repo_id,
                    },
                    fetchImpl
                );
                if (!token) {
                    repositories.push({ id: row.id, status: "not_installed" });
                    continue;
                }

                const [pulls, branches] = await Promise.all([
                    listOpenPullRequests(
                        token,
                        row.github_full_name,
                        fetchImpl
                    ),
                    listBranches(token, row.github_full_name, fetchImpl),
                ]);
                const plan = planBackfill(
                    await loadCandidateTasks(serviceClient, repository),
                    { branches, pulls }
                );
                const githubRepository = {
                    full_name: row.github_full_name,
                    id: row.github_repo_id,
                };
                const count = (result: SyncResult) =>
                    result.skipped ? 0 : result.taskIds.length;

                for (const pr of plan.pulls) {
                    linked += count(
                        await syncOpenedPullRequest(
                            serviceClient,
                            {
                                action: "opened",
                                pull_request: {
                                    body: pr.body,
                                    head: { ref: pr.headRef },
                                    html_url: pr.htmlUrl ?? undefined,
                                    number: pr.number,
                                    state: "open",
                                    title: pr.title,
                                },
                                repository: githubRepository,
                            },
                            log,
                            { repository }
                        )
                    );
                }

                for (const branchName of plan.branches) {
                    linked += count(
                        await syncCreatedBranch(
                            serviceClient,
                            {
                                ref: branchName,
                                ref_type: "branch",
                                repository: githubRepository,
                            },
                            log,
                            { repository }
                        )
                    );
                }

                repositories.push({ id: row.id, status: "synced" });
            } catch (error) {
                console.error(
                    JSON.stringify({
                        error:
                            error instanceof Error
                                ? error.message
                                : String(error),
                        reason: "backfill_failed",
                        repositoryId: row.id,
                    })
                );
                repositories.push({ id: row.id, status: "unavailable" });
            }
        }

        return json({
            configured: true,
            linked,
            repositories,
        } satisfies BackfillResponse);
    }, headersFor);
}
