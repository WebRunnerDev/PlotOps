import { describe, expect, it, vi } from "vitest";

import { createPostgresRateLimiter } from "./postgres-rate-limit";

const rule = { limit: 2, windowSec: 60 };

describe("createPostgresRateLimiter", () => {
    it("calls consume_edge_rate_limit and maps a block", async () => {
        const rpc = vi.fn(async () => ({
            data: [{ allowed: false, retry_after_sec: 42 }],
            error: null,
        }));
        const limiter = createPostgresRateLimiter(rpc);

        const result = await limiter.check("k", rule);

        expect(rpc).toHaveBeenCalledWith("consume_edge_rate_limit", {
            p_bucket: "k",
            p_limit: 2,
            p_window_seconds: 60,
        });
        expect(result).toEqual({ allowed: false, retryAfterSec: 42 });
    });

    it("maps an allowed row", async () => {
        const limiter = createPostgresRateLimiter(async () => ({
            data: [{ allowed: true, retry_after_sec: 0 }],
            error: null,
        }));

        expect(await limiter.check("k", rule)).toEqual({ allowed: true });
    });

    it("falls back to in-memory limiting when the RPC fails", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const limiter = createPostgresRateLimiter(async () => ({
            data: null,
            error: { message: "boom" },
        }));

        await expect(limiter.check("k", rule)).resolves.toMatchObject({
            allowed: true,
        });
        await expect(limiter.check("k", rule)).resolves.toMatchObject({
            allowed: true,
        });
        await expect(limiter.check("k", rule)).resolves.toMatchObject({
            allowed: false,
        });
        warn.mockRestore();
    });

    it("uses in-memory limiting without an RPC", async () => {
        const limiter = createPostgresRateLimiter(null);

        await limiter.check("k", rule);
        await limiter.check("k", rule);

        await expect(limiter.check("k", rule)).resolves.toMatchObject({
            allowed: false,
        });
        await expect(limiter.check("other", rule)).resolves.toMatchObject({
            allowed: true,
        });
    });
});
