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
    buildInviteEmailHtml,
    buildInviteEmailText,
    buildInviteRedeemUrl,
    resolveInviteAppOrigin,
    resolveMailDelivery,
} from "./invite-email.ts";
import { sendResendEmail } from "./resend.ts";
import {
    clientIpFrom,
    TURNSTILE_INVITE_ACTION,
    verifyTurnstileToken,
} from "./turnstile.ts";

export const INVITE_MAX_BODY_BYTES = 8 * 1024;

/** Per signed-in user — one Team manager re-sending invites. */
export const INVITE_USER_RULE: RateLimitRule = { limit: 30, windowSec: 3600 };
/** Per client IP — several accounts behind one address. */
export const INVITE_IP_RULE: RateLimitRule = { limit: 60, windowSec: 3600 };

export const inviteRequestSchema = z.object({
    // Turnstile tokens are ≤ 2048 chars.
    captchaToken: z.string().max(4096).optional(),
    inviteId: z.uuid(),
});

export type SendTeamInviteDeps = {
    cors: CorsPolicy;
    /** Caller-scoped client (RLS applies); `null` when Supabase env is missing. */
    createUserClient: (authHeader: string) => null | SupabaseClient;
    env: (name: string) => string | undefined;
    fetchImpl?: typeof fetch;
    rateLimiter: RateLimiter;
};

type InviteRow = {
    email: null | string;
    kind: string;
    role: string;
    status: string;
    team_id: string;
    teams: null | { name: string } | { name: string }[];
    token: string;
};

export function createSendTeamInviteHandler(
    deps: SendTeamInviteDeps
): (request: Request) => Promise<Response> {
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

        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return json({ error: "unauthorized" }, 401);
        }

        const rawBody = await readBodyText(request, INVITE_MAX_BODY_BYTES);
        if (!rawBody.ok) {
            return json({ error: rawBody.error }, rawBody.status);
        }
        const body = parseJsonBody(rawBody.text, inviteRequestSchema);
        if (!body.ok) {
            return json({ error: body.error }, body.status);
        }
        const { captchaToken, inviteId } = body.data;

        const supabase = deps.createUserClient(authHeader);
        if (!supabase) {
            console.error(JSON.stringify({ reason: "missing_supabase_env" }));
            return json({ error: "server_misconfigured" }, 500);
        }

        // The gateway verifies the JWT signature (verify_jwt); getUser also
        // rejects revoked sessions.
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) {
            return json({ error: "unauthorized" }, 401);
        }

        const clientIp = clientIpFrom(request.headers);
        const checks: [string, RateLimitRule][] = [
            [`send-team-invite:user:${user.id}`, INVITE_USER_RULE],
        ];
        if (clientIp) {
            checks.push([`send-team-invite:ip:${clientIp}`, INVITE_IP_RULE]);
        }
        for (const [key, rule] of checks) {
            const limit = await deps.rateLimiter.check(key, rule);
            if (!limit.allowed) {
                return json(
                    {
                        error: "rate_limited",
                        retryAfterSec: limit.retryAfterSec,
                    },
                    429
                );
            }
        }

        // Bot protection: when the Turnstile secret is set, every send needs a
        // fresh single-use token from the SPA widget (action "invite").
        const turnstileSecret = deps.env("TURNSTILE_SECRET_KEY")?.trim();
        if (turnstileSecret) {
            const captcha = await verifyTurnstileToken(
                {
                    expectedAction: TURNSTILE_INVITE_ACTION,
                    remoteIp: clientIp,
                    secret: turnstileSecret,
                    token: captchaToken,
                },
                deps.fetchImpl
            );
            if (!captcha.ok) {
                console.warn(
                    JSON.stringify({
                        inviteId,
                        reason: `captcha_${captcha.reason}`,
                        userId: user.id,
                    })
                );
                return json({ error: "captcha_failed" }, 403);
            }
        }

        // Team permission: RLS `team_invites_select` only returns rows where
        // can_manage_team_members(team_id) — non-managers see "not found".
        const { data: invite, error: inviteError } = await supabase
            .from("team_invites")
            .select("email, kind, role, status, team_id, token, teams(name)")
            .eq("id", inviteId)
            .maybeSingle();

        if (inviteError) {
            console.error(
                JSON.stringify({
                    error: inviteError.message,
                    inviteId,
                    reason: "invite_load_failed",
                })
            );
            return json({ error: "invite_load_failed" }, 500);
        }

        if (!invite) {
            return json({ error: "invite_not_found" }, 404);
        }

        const row = invite as InviteRow;

        if (row.kind !== "email") {
            return json({ error: "not_email_invite", skipped: true }, 400);
        }

        if (row.status !== "pending") {
            return json({ error: "invite_not_pending" }, 400);
        }

        if (!row.email?.trim() || !row.token) {
            return json({ error: "invite_incomplete" }, 400);
        }

        const delivery = resolveMailDelivery({
            fromEmail: deps.env("INVITE_FROM_EMAIL"),
            resendApiKey: deps.env("RESEND_API_KEY"),
        });

        const toEmail = row.email.trim();

        if (!delivery.send) {
            // Never log inviteUrl/token — Edge Function logs may leave the request path.
            console.log(
                JSON.stringify({
                    inviteId,
                    reason: delivery.reason,
                    skipped: true,
                    to: toEmail,
                    userId: user.id,
                })
            );
            return json({
                ok: true,
                reason: delivery.reason,
                skipped: true,
            });
        }

        const origin = resolveInviteAppOrigin(deps.env("INVITE_APP_ORIGIN"));
        const inviteUrl = origin
            ? buildInviteRedeemUrl(origin, row.token)
            : null;
        if (!origin || !inviteUrl) {
            return json({ error: "origin_required" }, 400);
        }

        const teamName = teamNameFrom(row.teams) ?? "a team";
        const fields = {
            email: toEmail,
            inviteUrl,
            role: row.role,
            teamName,
        };

        const resendKey = deps.env("RESEND_API_KEY")!.trim();
        const result = await sendResendEmail(
            resendKey,
            {
                from: delivery.fromEmail,
                html: buildInviteEmailHtml(fields),
                subject: `Join ${teamName} on PlotOps`,
                text: buildInviteEmailText(fields),
                to: [toEmail],
            },
            deps.fetchImpl
        );

        if (!result.ok) {
            console.error(
                JSON.stringify({
                    error: result.error,
                    inviteId,
                    reason: "resend_failed",
                    status: result.status,
                })
            );
            return json({ error: "send_failed" }, 502);
        }

        console.log(
            JSON.stringify({
                emailId: result.id,
                inviteId,
                ok: true,
                to: fields.email,
                userId: user.id,
            })
        );

        return json({ emailId: result.id, ok: true });
    }, headersFor);
}

function teamNameFrom(
    value: null | undefined | { name: string } | { name: string }[]
): null | string {
    if (!value) return null;
    const row = Array.isArray(value) ? value[0] : value;
    const name = row?.name?.trim();
    return name && name.length > 0 ? name : null;
}
