import { describe, expect, it } from "vitest";

import { createSlidingWindowRateLimiter } from "./sliding-window-rate-limit";

describe("createSlidingWindowRateLimiter", () => {
    it("allows requests under the limit", () => {
        const limiter = createSlidingWindowRateLimiter({
            limit: 2,
            windowMs: 60_000,
        });

        expect(limiter.check("user:1", 1_000).allowed).toBe(true);
        expect(limiter.check("user:1", 2_000).allowed).toBe(true);
    });

    it("blocks when the window is full", () => {
        const limiter = createSlidingWindowRateLimiter({
            limit: 2,
            windowMs: 60_000,
        });

        limiter.check("user:1", 1_000);
        limiter.check("user:1", 2_000);
        const blocked = limiter.check("user:1", 3_000);

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

        limiter.check("user:a", 1_000);
        expect(limiter.check("user:b", 1_100).allowed).toBe(true);
    });

    it("expires timestamps outside the window", () => {
        const limiter = createSlidingWindowRateLimiter({
            limit: 1,
            windowMs: 10_000,
        });

        limiter.check("user:1", 1_000);
        expect(limiter.check("user:1", 12_000).allowed).toBe(true);
    });
});
