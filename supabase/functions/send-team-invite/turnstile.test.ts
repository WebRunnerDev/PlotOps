import { describe, expect, it, vi } from "vitest";

import { clientIpFrom, verifyTurnstileToken } from "./turnstile";

function fakeFetch(body: unknown, status = 200) {
    return vi.fn(async () => Response.json(body, { status }));
}

const base = { expectedAction: "invite", secret: "s3cret" };

describe("verifyTurnstileToken", () => {
    it("rejects a missing token without calling siteverify", async () => {
        const fetchImpl = fakeFetch({ success: true });

        const result = await verifyTurnstileToken(
            { ...base, token: "  " },
            fetchImpl
        );

        expect(result).toEqual({ ok: false, reason: "token_missing" });
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("posts secret, token and remote ip to siteverify", async () => {
        const fetchImpl = fakeFetch({ action: "invite", success: true });

        const result = await verifyTurnstileToken(
            { ...base, remoteIp: "203.0.113.7", token: "tok" },
            fetchImpl
        );

        expect(result).toEqual({ ok: true });
        const [url, init] = fetchImpl.mock.calls[0] as unknown as [
            string,
            RequestInit,
        ];
        expect(url).toBe(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify"
        );
        const form = init.body as URLSearchParams;
        expect(form.get("secret")).toBe("s3cret");
        expect(form.get("response")).toBe("tok");
        expect(form.get("remoteip")).toBe("203.0.113.7");
    });

    it("rejects when Cloudflare reports failure", async () => {
        const result = await verifyTurnstileToken(
            { ...base, token: "tok" },
            fakeFetch({
                "error-codes": ["invalid-input-response"],
                success: false,
            })
        );

        expect(result).toEqual({ ok: false, reason: "siteverify_rejected" });
    });

    it("rejects a token issued for another action", async () => {
        const result = await verifyTurnstileToken(
            { ...base, token: "tok" },
            fakeFetch({ action: "login", success: true })
        );

        expect(result).toEqual({ ok: false, reason: "action_mismatch" });
    });

    it("accepts test-key responses with an empty action", async () => {
        const result = await verifyTurnstileToken(
            { ...base, token: "XXXX.DUMMY.TOKEN.XXXX" },
            fakeFetch({ action: "", success: true })
        );

        expect(result).toEqual({ ok: true });
    });

    it("fails closed when siteverify is unreachable", async () => {
        const fetchImpl = vi.fn(async () => {
            throw new TypeError("network down");
        });

        const result = await verifyTurnstileToken(
            { ...base, token: "tok" },
            fetchImpl
        );

        expect(result).toEqual({
            ok: false,
            reason: "siteverify_unavailable",
        });
    });

    it("fails closed on a non-2xx siteverify response", async () => {
        const result = await verifyTurnstileToken(
            { ...base, token: "tok" },
            fakeFetch({}, 503)
        );

        expect(result).toEqual({
            ok: false,
            reason: "siteverify_unavailable",
        });
    });
});

describe("clientIpFrom", () => {
    it("prefers cf-connecting-ip", () => {
        const headers = new Headers({
            "cf-connecting-ip": "198.51.100.1",
            "x-forwarded-for": "203.0.113.7, 10.0.0.1",
        });
        expect(clientIpFrom(headers)).toBe("198.51.100.1");
    });

    it("falls back to the first x-forwarded-for hop", () => {
        const headers = new Headers({
            "x-forwarded-for": "203.0.113.7, 10.0.0.1",
        });
        expect(clientIpFrom(headers)).toBe("203.0.113.7");
    });

    it("returns null without proxy headers", () => {
        expect(clientIpFrom(new Headers())).toBeNull();
    });
});
