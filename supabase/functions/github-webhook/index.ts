// Deno Edge runtime resolves https imports; Node/eslint cannot.
// eslint-disable-next-line import-x/no-unresolved -- esm.sh URL for Deno deploy
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { createSlidingWindowRateLimiter } from "../_shared/sliding-window-rate-limit.ts";
import { syncMergedPullRequest } from "./sync.ts";
import { verifyGitHubSignature } from "./verify-signature.ts";

const webhookIpLimiter = createSlidingWindowRateLimiter({
    limit: 120,
    windowMs: 60 * 1000,
});

const corsHeaders = {
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-github-event, x-github-delivery",
    "Access-Control-Allow-Origin": "*",
};

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
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

    const secret = Deno.env.get("GITHUB_WEBHOOK_SECRET") ?? "";
    const rawBody = await request.text();
    const signature = request.headers.get("X-Hub-Signature-256");
    const deliveryId = request.headers.get("X-GitHub-Delivery");
    const eventName = request.headers.get("X-GitHub-Event") ?? "unknown";

    const valid = await verifyGitHubSignature(rawBody, signature, secret);
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

    let payload: unknown;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        log({ reason: "invalid_json" });
        return json({ error: "invalid_json" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
        console.error(JSON.stringify({ reason: "missing_supabase_env" }));
        return json({ error: "server_misconfigured" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    try {
        const result = await syncMergedPullRequest(
            supabase,
            payload as Record<string, unknown>,
            log
        );
        return json(result);
    } catch (error) {
        console.error(
            JSON.stringify({
                deliveryId,
                error: error instanceof Error ? error.message : String(error),
                reason: "sync_failed",
            })
        );
        // 500 only for unexpected failures — GitHub may retry, which is OK.
        return json({ error: "sync_failed" }, 500);
    }
});

function json(body: unknown, status = 200): Response {
    return Response.json(body, {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
    });
}
