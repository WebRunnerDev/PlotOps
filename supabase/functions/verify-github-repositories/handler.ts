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
import { checkRepositoryAccess } from "./github-repository-access.ts";

export const VERIFY_MAX_BODY_BYTES = 4096;

/** Per signed-in user — one call per Create Project or Repository link. */
export const VERIFY_USER_RULE: RateLimitRule = {
    limit: 60,
    windowSec: 3600,
};

/** Matches the Repository cap per Project (`project_repositories_cap()`). */
export const VERIFY_MAX_REPOSITORIES = 5;

export const verifyRequestSchema = z.object({
    /** The caller's GitHub OAuth token; used for this request only, never stored. */
    githubToken: z
        .string()
        .min(1)
        .max(255)
        .regex(/^[\w-]+$/),
    repositories: z
        .array(
            z.object({
                fullName: z
                    .string()
                    .min(3)
                    .max(200)
                    .regex(/^[\w.-]+\/[\w.-]+$/),
                id: z.number().int().positive(),
            })
        )
        .min(1)
        .max(VERIFY_MAX_REPOSITORIES),
});

export type VerifyGithubRepositoriesDeps = {
    cors: CorsPolicy;
    /** Service-role client that writes verifications; `null` when env is missing. */
    createServiceClient: () => null | SupabaseClient;
    /** Caller-scoped client (resolves the user); `null` when env is missing. */
    createUserClient: (authHeader: string) => null | SupabaseClient;
    fetchImpl?: typeof fetch;
    rateLimiter: RateLimiter;
};

export type VerifyRepositoryStatus = "no_access" | "unavailable" | "verified";

export type VerifyResponse = {
    repositories: { id: number; status: VerifyRepositoryStatus }[];
};

/**
 * `POST { githubToken, repositories: [{ id, fullName }] }` → asks GitHub, with
 * the caller's own token, whether they can reach each repository, and records
 * each confirmed one in `github_repository_verifications` (BUG-163). Postgres
 * lets a client link a Repository only with a recent verification of its own,
 * and takes the name, URL, default branch and visibility from it.
 */
export function createVerifyGithubRepositoriesHandler(
    deps: VerifyGithubRepositoriesDeps
): (request: Request) => Promise<Response> {
    const headersFor = (request: Request) =>
        corsHeadersFor(request.headers.get("Origin"), deps.cors);
    const fetchImpl = deps.fetchImpl ?? fetch;

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

        const rawBody = await readBodyText(request, VERIFY_MAX_BODY_BYTES);
        if (!rawBody.ok) {
            return json({ error: rawBody.error }, rawBody.status);
        }
        const body = parseJsonBody(rawBody.text, verifyRequestSchema);
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
            `verify-github-repositories:user:${user.id}`,
            VERIFY_USER_RULE
        );
        if (!limit.allowed) {
            return json(
                { error: "rate_limited", retryAfterSec: limit.retryAfterSec },
                429
            );
        }

        const { githubToken, repositories } = body.data;
        const results = await Promise.all(
            repositories.map((repository) =>
                checkRepositoryAccess(githubToken, repository, fetchImpl)
            )
        );

        const verified = results.flatMap((result) =>
            result.status === "verified" ? [result.repository] : []
        );
        if (verified.length > 0) {
            const { error } = await serviceClient
                .from("github_repository_verifications")
                .upsert(
                    verified.map((repository) => ({
                        github_default_branch: repository.defaultBranch,
                        github_full_name: repository.fullName,
                        github_html_url: repository.htmlUrl,
                        github_repo_id: repository.id,
                        is_private: repository.isPrivate,
                        user_id: user.id,
                        verified_at: new Date().toISOString(),
                    })),
                    { onConflict: "user_id,github_repo_id" }
                );
            if (error) {
                console.error(
                    JSON.stringify({
                        error: error.message,
                        reason: "verification_write_failed",
                    })
                );
                return json({ error: "verification_write_failed" }, 500);
            }
        }

        return json({
            repositories: repositories.map((repository, index) => {
                const result = results[index];
                return {
                    id: repository.id,
                    status:
                        result?.status === "verified"
                            ? "verified"
                            : (result?.reason ?? "unavailable"),
                };
            }),
        } satisfies VerifyResponse);
    }, headersFor);
}
