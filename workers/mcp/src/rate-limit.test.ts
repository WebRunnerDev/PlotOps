import { describe, expect, it } from "vitest";

import {
    checkRateLimit,
    createSlidingWindowRateLimiter,
} from "./rate-limit.ts";

describe("createSlidingWindowRateLimiter", () => {
    it("allows requests under the limit", () => {
        const limiter = createSlidingWindowRateLimiter({
            limit: 2,
            windowMs: 60_000,
        });

        expect(limiter.check("user:1", 1000).allowed).toBe(true);
        expect(limiter.check("user:1", 2000).allowed).toBe(true);
    });

    it("blocks when the window is full", () => {
        const limiter = createSlidingWindowRateLimiter({
            limit: 2,
            windowMs: 60_000,
        });

        limiter.check("user:1", 1000);
        limiter.check("user:1", 2000);
        const blocked = limiter.check("user:1", 3000);

        expect(blocked.allowed).toBe(false);
        if (!blocked.allowed) {
            expect(blocked.retryAfterSec).toBeGreaterThan(0);
        }
    });

    it("tracks keys independently", () => {
        const limiter = createSlidingWindowRateLimiter({
            limit: 1,
            windowMs: 60_000,
        });

        limiter.check("user:a", 1000);
        expect(limiter.check("user:b", 1100).allowed).toBe(true);
    });
});

describe("checkRateLimit", () => {
    it("uses the binding verdict when present", async () => {
        const fallback = createSlidingWindowRateLimiter({
            limit: 100,
            windowMs: 60_000,
        });
        const keys: string[] = [];
        const binding = {
            limit: async ({ key }: { key: string }) => {
                keys.push(key);
                return { success: false };
            },
        };
        await expect(checkRateLimit(binding, fallback, "user:1")).resolves.toBe(
            false
        );
        expect(keys).toEqual(["user:1"]);
    });

    it("falls back to the in-memory window without a binding", async () => {
        const fallback = createSlidingWindowRateLimiter({
            limit: 1,
            windowMs: 60_000,
        });
        await expect(checkRateLimit(undefined, fallback, "ip:a")).resolves.toBe(
            true
        );
        await expect(checkRateLimit(undefined, fallback, "ip:a")).resolves.toBe(
            false
        );
    });

    it("falls back when the binding throws", async () => {
        const fallback = createSlidingWindowRateLimiter({
            limit: 5,
            windowMs: 60_000,
        });
        const binding = {
            limit: async () => {
                throw new Error("binding unavailable");
            },
        };
        await expect(checkRateLimit(binding, fallback, "ip:b")).resolves.toBe(
            true
        );
    });
});
