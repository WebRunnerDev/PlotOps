import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { z } from "zod";

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
import { createSlidingWindowRateLimiter } from "../_shared/sliding-window-rate-limit.ts";
import {
    syncClosedPullRequest,
    syncMergedPullRequest,
    syncReopenedPullRequest,
} from "./sync.ts";
import { verifyGitHubSignature } from "./verify-signature.ts";

/** GitHub caps deliveries at 25 MB; pull_request payloads stay far below. */
export const WEBHOOK_MAX_BODY_BYTES = 5 * 1024 * 1024;

/** Only the fields sync.ts reads; anything else is stripped. */
export const pullRequestPayloadSchema = z.object({
    action: z.string().max(64).optional(),
    pull_request: z
        .object({
            base: z.object({ ref: z.string().max(255).optional() }).optional(),
            head: z.object({ ref: z.string().max(255).optional() }).optional(),
            html_url: z.string().max(2048).optional(),
            // GitHub documents `merged` as boolean | null.
            merged: z
                .boolean()
                .nullish()
                .transform((value) => value ?? undefined),
            number: z.number().int().positive().optional(),
            state: z.string().max(32).optional(),
        })
        .optional(),
    repository: z
        .object({
            full_name: z.string().max(255).optional(),
            id: z.number().int().optional(),
        })
        .optional(),
});

export type WebhookHandlerDeps = {
    cors: CorsPolicy;
    /** `null` when Supabase env is missing. */
    createServiceClient: () => null | SupabaseClient;
    webhookSecret: string;
};

export function createWebhookHandler(
    deps: WebhookHandlerDeps
): (request: Request) => Promise<Response> {
    const webhookIpLimiter = createSlidingWindowRateLimiter({
        limit: 120,
        windowMs: 60 * 1000,
    });
    const headersFor = (request: Request) =>
        corsHeadersFor(request.headers.get("Origin"), deps.cors);

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

        const clientIp =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "unknown";
        const ipLimit = webhookIpLimiter.check(`ip:${clientIp}`);
        if (!ipLimit.allowed) {
            return json(
                {
                    error: "rate_limited",
                    retryAfterSec: ipLimit.retryAfterSec,
                },
                429
            );
        }

        const signature = request.headers.get("X-Hub-Signature-256");
        const deliveryId = request.headers.get("X-GitHub-Delivery");
        const eventName = request.headers.get("X-GitHub-Event") ?? "unknown";

        // Unsigned requests are rejected before the body is even read.
        if (!signature) {
            console.error(
                JSON.stringify({
                    deliveryId,
                    event: eventName,
                    reason: "missing_signature",
                })
            );
            return json({ error: "invalid_signature" }, 401);
        }

        const body = await readBodyText(request, WEBHOOK_MAX_BODY_BYTES);
        if (!body.ok) {
            return json({ error: body.error }, body.status);
        }
        const rawBody = body.text;

        const valid = await verifyGitHubSignature(
            rawBody,
            signature,
            deps.webhookSecret
        );
        if (!valid) {
            console.error(
                JSON.stringify({
                    deliveryId,
                    event: eventName,
                    reason: "invalid_signature",
                })
            );
            return json({ error: "invalid_signature" }, 401);
        }

        const log = (fields: Record<string, unknown>) => {
            console.log(
                JSON.stringify({
                    deliveryId,
                    event: eventName,
                    ...fields,
                })
            );
        };

        if (eventName === "push") {
            log({ reason: "push_noop", skipped: true });
            return json({ ok: true, reason: "push_noop", skipped: true });
        }

        if (eventName !== "pull_request") {
            log({ reason: "ignored_event", skipped: true });
            return json({ ok: true, reason: "ignored_event", skipped: true });
        }

        const parsed = parseJsonBody(rawBody, pullRequestPayloadSchema);
        if (!parsed.ok) {
            log({ reason: parsed.error });
            return json({ error: parsed.error }, parsed.status);
        }
        const payload = parsed.data;

        const supabase = deps.createServiceClient();
        if (!supabase) {
            console.error(JSON.stringify({ reason: "missing_supabase_env" }));
            return json({ error: "server_misconfigured" }, 500);
        }

        try {
            const mergeResult = await syncMergedPullRequest(
                supabase,
                payload,
                log
            );
            if (
                !mergeResult.skipped ||
                mergeResult.reason !== "not_merged_pr"
            ) {
                return json(mergeResult);
            }

            const closeResult = await syncClosedPullRequest(
                supabase,
                payload,
                log
            );
            if (
                !closeResult.skipped ||
                closeResult.reason !== "not_closed_unmerged_pr"
            ) {
                return json(closeResult);
            }

            const reopenResult = await syncReopenedPullRequest(
                supabase,
                payload,
                log
            );
            return json(reopenResult);
        } catch (error) {
            console.error(
                JSON.stringify({
                    deliveryId,
                    error:
                        error instanceof Error ? error.message : String(error),
                    reason: "sync_failed",
                })
            );
            // 500 only for unexpected failures — GitHub may retry, which is OK.
            return json({ error: "sync_failed" }, 500);
        }
    }, headersFor);
}
