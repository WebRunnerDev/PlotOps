import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { describe, expect, it, vi } from "vitest";

import type { RateLimiter } from "../_shared/postgres-rate-limit";

import { createPostgresRateLimiter } from "../_shared/postgres-rate-limit";
import {
    createSendTeamInviteHandler,
    INVITE_MAX_BODY_BYTES,
    INVITE_USER_RULE,
} from "./handler";

const APP_ORIGIN = "https://plotops.webrunner.dev";
const INVITE_ID = "6f1c2c1e-6d0b-4a8e-9a57-6c5d1c7c1a11";

function fakeSupabase(invite: null | Record<string, unknown> = null) {
    return {
        auth: {
            getUser: vi.fn(async () => ({
                data: { user: { id: "user-1" } },
                error: null,
            })),
        },
        from: vi.fn(() => ({
            select: () => ({
                eq: () => ({
                    maybeSingle: async () => ({ data: invite, error: null }),
                }),
            }),
        })),
    } as unknown as SupabaseClient;
}

function invite(body: unknown, headers: Record<string, string> = {}): Request {
    return new Request("https://edge.test/send-team-invite", {
        body: typeof body === "string" ? body : JSON.stringify(body),
        headers: {
            Authorization: "Bearer jwt",
            "Content-Type": "application/json",
            Origin: APP_ORIGIN,
            ...headers,
        },
        method: "POST",
    });
}

function setup(
    options: {
        invite?: null | Record<string, unknown>;
        rateLimiter?: RateLimiter;
    } = {}
) {
    const supabase = fakeSupabase(options.invite ?? null);
    const handler = createSendTeamInviteHandler({
        cors: {
            allowedOrigins: [APP_ORIGIN],
            allowHeaders: "authorization, content-type",
        },
        createUserClient: () => supabase,
        env: () => {},
        rateLimiter: options.rateLimiter ?? createPostgresRateLimiter(null),
    });
    return { handler, supabase };
}

describe("send-team-invite handler", () => {
    it("rejects a request without a bearer token", async () => {
        const { handler } = setup();
        const response = await handler(
            invite({ inviteId: INVITE_ID }, { Authorization: "" })
        );

        expect(response.status).toBe(401);
    });

    it.each([
        ["missing inviteId", {}],
        ["non-uuid inviteId", { inviteId: "1; drop table" }],
        ["non-string captcha", { captchaToken: 42, inviteId: INVITE_ID }],
    ])("returns 400 for %s", async (_label, body) => {
        const { handler, supabase } = setup();
        const response = await handler(invite(body));

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: "invalid_body" });
        expect(supabase.auth.getUser).not.toHaveBeenCalled();
    });

    it("returns 400 for malformed JSON", async () => {
        const { handler } = setup();
        const response = await handler(invite("{oops"));

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: "invalid_json" });
    });

    it("returns 413 for an oversized body", async () => {
        const { handler } = setup();
        const response = await handler(
            invite({
                captchaToken: "x".repeat(INVITE_MAX_BODY_BYTES),
                inviteId: INVITE_ID,
            })
        );

        expect(response.status).toBe(413);
    });

    it("answers 429 once the per-user limit is spent", async () => {
        const { handler } = setup();

        for (let index = 0; index < INVITE_USER_RULE.limit; index += 1) {
            const ok = await handler(invite({ inviteId: INVITE_ID }));
            expect(ok.status).toBe(404);
        }
        const blocked = await handler(invite({ inviteId: INVITE_ID }));

        expect(blocked.status).toBe(429);
        expect(await blocked.json()).toMatchObject({ error: "rate_limited" });
    });

    it("rate-limits by client IP too", async () => {
        const check = vi.fn(async (key: string) =>
            key.includes(":ip:")
                ? { allowed: false as const, retryAfterSec: 30 }
                : { allowed: true as const }
        );
        const { handler } = setup({ rateLimiter: { check } });
        const response = await handler(
            invite(
                { inviteId: INVITE_ID },
                { "cf-connecting-ip": "203.0.113.7" }
            )
        );

        expect(response.status).toBe(429);
        expect(check).toHaveBeenCalledWith(
            "send-team-invite:ip:203.0.113.7",
            expect.anything()
        );
    });

    it("returns 404 when RLS hides the invite (caller cannot manage the Team)", async () => {
        const { handler } = setup({ invite: null });
        const response = await handler(invite({ inviteId: INVITE_ID }));

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ error: "invite_not_found" });
    });

    it("echoes CORS headers for the app origin", async () => {
        const { handler } = setup();
        const response = await handler(invite({ inviteId: INVITE_ID }));

        expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
            APP_ORIGIN
        );
    });

    it("sends no CORS headers to a foreign Origin", async () => {
        const { handler } = setup();
        const response = await handler(
            invite({ inviteId: INVITE_ID }, { Origin: "https://evil.example" })
        );

        expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("refuses a preflight from a foreign Origin", async () => {
        const { handler } = setup();
        const response = await handler(
            new Request("https://edge.test/send-team-invite", {
                headers: { Origin: "https://evil.example" },
                method: "OPTIONS",
            })
        );

        expect(response.status).toBe(403);
        expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("hides internal errors behind a generic 500", async () => {
        const supabase = fakeSupabase();
        vi.mocked(supabase.auth.getUser).mockRejectedValueOnce(
            new Error("connection refused at db.internal:5432")
        );
        const handler = createSendTeamInviteHandler({
            cors: { allowedOrigins: [APP_ORIGIN], allowHeaders: "" },
            createUserClient: () => supabase,
            env: () => {},
            rateLimiter: createPostgresRateLimiter(null),
        });
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});

        const response = await handler(invite({ inviteId: INVITE_ID }));

        expect(response.status).toBe(500);
        const text = await response.text();
        expect(text).toBe('{"error":"internal_error"}');
        spy.mockRestore();
    });
});
