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
import {
    buildInstallUrl,
    createAppJwt,
    fetchApp,
    fetchRepositoryInstallation,
    type InstallationStatus,
} from "./github-app.ts";

export const APP_STATUS_MAX_BODY_BYTES = 1024;

/** Per signed-in user — Project Settings asks once per visit and on refocus. */
export const APP_STATUS_USER_RULE: RateLimitRule = {
    limit: 120,
    windowSec: 3600,
};

export const appStatusRequestSchema = z.object({ projectId: z.uuid() });

export type GithubAppStatusDeps = {
    cors: CorsPolicy;
    /** Caller-scoped client (RLS applies); `null` when Supabase env is missing. */
    createUserClient: (authHeader: string) => null | SupabaseClient;
    env: (name: string) => string | undefined;
    fetchImpl?: typeof fetch;
    nowSec?: () => number;
    rateLimiter: RateLimiter;
};

export type GithubAppStatusResponse = {
    /** False when the App credentials are not configured on the server. */
    configured: boolean;
    installUrl: null | string;
    repositories: { id: string; status: InstallationStatus }[];
};

type RepositoryRow = { github_full_name: string; id: string };

/**
 * `POST { projectId }` → GitHub App installation status of each Repository in
 * the Project. Only Team members see the rows (RLS on `project_repositories`);
 * the App JWT never leaves the function.
 */
export function createGithubAppStatusHandler(
    deps: GithubAppStatusDeps
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

        const rawBody = await readBodyText(request, APP_STATUS_MAX_BODY_BYTES);
        if (!rawBody.ok) {
            return json({ error: rawBody.error }, rawBody.status);
        }
        const body = parseJsonBody(rawBody.text, appStatusRequestSchema);
        if (!body.ok) {
            return json({ error: body.error }, body.status);
        }

        const supabase = deps.createUserClient(authHeader);
        if (!supabase) {
            console.error(JSON.stringify({ reason: "missing_supabase_env" }));
            return json({ error: "server_misconfigured" }, 500);
        }

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) {
            return json({ error: "unauthorized" }, 401);
        }

        const limit = await deps.rateLimiter.check(
            `github-app-status:user:${user.id}`,
            APP_STATUS_USER_RULE
        );
        if (!limit.allowed) {
            return json(
                { error: "rate_limited", retryAfterSec: limit.retryAfterSec },
                429
            );
        }

        const { data, error } = await supabase
            .from("project_repositories")
            .select("id, github_full_name")
            .eq("project_id", body.data.projectId);
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
        const environmentInstallUrl = buildInstallUrl(
            deps.env("GITHUB_APP_SLUG")
        );

        const allUnknown = rows.map((row) => ({
            id: row.id,
            status: "unknown" as const,
        }));

        if (!appId || !privateKey) {
            return json({
                configured: false,
                installUrl: environmentInstallUrl,
                repositories: allUnknown,
            } satisfies GithubAppStatusResponse);
        }

        const jwt = await createAppJwt(appId, privateKey, nowSec());
        const app = await fetchApp(jwt, fetchImpl);
        if (!app) {
            console.error(JSON.stringify({ reason: "app_auth_failed" }));
            return json({
                configured: true,
                installUrl: environmentInstallUrl,
                repositories: allUnknown,
            } satisfies GithubAppStatusResponse);
        }

        const installUrl = environmentInstallUrl ?? buildInstallUrl(app.slug);
        const statuses = await Promise.all(
            rows.map((row) =>
                fetchRepositoryInstallation(
                    jwt,
                    row.github_full_name,
                    fetchImpl
                )
            )
        );

        return json({
            configured: true,
            installUrl,
            repositories: rows.map((row, index) => ({
                id: row.id,
                status: statuses[index] ?? "unknown",
            })),
        } satisfies GithubAppStatusResponse);
    }, headersFor);
}
