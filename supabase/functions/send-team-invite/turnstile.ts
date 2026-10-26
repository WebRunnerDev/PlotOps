export const TURNSTILE_INVITE_ACTION = "invite";

const SITEVERIFY_URL =
    "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileVerifyResult =
    { ok: false; reason: TurnstileFailureReason } | { ok: true };

type SiteverifyResponse = {
    action?: string;
    "error-codes"?: string[];
    success?: boolean;
};

type TurnstileFailureReason =
    | "action_mismatch"
    | "siteverify_rejected"
    | "siteverify_unavailable"
    | "token_missing";

/** First client IP from Edge proxy headers (optional siteverify hint). */
export function clientIpFrom(headers: Headers): null | string {
    const cfIp = headers.get("cf-connecting-ip")?.trim();
    if (cfIp) return cfIp;
    const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwarded || null;
}

/**
 * Server-side Turnstile check via Cloudflare `siteverify`.
 * Inject `fetch` for tests; Deno Edge uses global fetch.
 */
export async function verifyTurnstileToken(
    input: {
        expectedAction: string;
        remoteIp?: null | string;
        secret: string;
        token: unknown;
    },
    fetchImpl: typeof fetch = fetch
): Promise<TurnstileVerifyResult> {
    const token = typeof input.token === "string" ? input.token.trim() : "";
    if (!token) return { ok: false, reason: "token_missing" };

    const form = new URLSearchParams({ response: token, secret: input.secret });
    if (input.remoteIp) form.set("remoteip", input.remoteIp);

    let body: SiteverifyResponse;
    try {
        const response = await fetchImpl(SITEVERIFY_URL, {
            body: form,
            method: "POST",
        });
        if (!response.ok) {
            return { ok: false, reason: "siteverify_unavailable" };
        }
        body = (await response.json()) as SiteverifyResponse;
    } catch {
        return { ok: false, reason: "siteverify_unavailable" };
    }

    if (body.success !== true) {
        return { ok: false, reason: "siteverify_rejected" };
    }

    // Cloudflare test secrets echo an empty action — only enforce when present.
    if (body.action && body.action !== input.expectedAction) {
        return { ok: false, reason: "action_mismatch" };
    }

    return { ok: true };
}
