import { z } from "zod";

import { createSlidingWindowRateLimiter } from "./sliding-window-rate-limit.ts";

export type RateLimitDecision =
    { allowed: false; retryAfterSec: number } | { allowed: true };

export type RateLimiter = {
    check(key: string, rule: RateLimitRule): Promise<RateLimitDecision>;
};

export type RateLimitRpc = (
    name: "consume_edge_rate_limit",
    parameters: { p_bucket: string; p_limit: number; p_window_seconds: number }
) => PromiseLike<{ data: unknown; error: null | { message: string } }>;

export type RateLimitRule = { limit: number; windowSec: number };

const rpcRowsSchema = z
    .array(
        z.object({
            allowed: z.boolean(),
            retry_after_sec: z.number().int().nonnegative(),
        })
    )
    .min(1);

/**
 * Rate limit shared across Edge isolates via `public.consume_edge_rate_limit`
 * (service-role RPC). When the RPC is unavailable (no service key, DB error)
 * it degrades to a per-isolate in-memory window rather than failing open.
 */
export function createPostgresRateLimiter(
    rpc: null | RateLimitRpc
): RateLimiter {
    const fallbacks = new Map<
        string,
        ReturnType<typeof createSlidingWindowRateLimiter>
    >();

    function fallback(key: string, rule: RateLimitRule): RateLimitDecision {
        const ruleKey = `${rule.limit}/${rule.windowSec}`;
        let limiter = fallbacks.get(ruleKey);
        if (!limiter) {
            limiter = createSlidingWindowRateLimiter({
                limit: rule.limit,
                windowMs: rule.windowSec * 1000,
            });
            fallbacks.set(ruleKey, limiter);
        }
        return limiter.check(key);
    }

    return {
        async check(key, rule) {
            if (!rpc) return fallback(key, rule);

            const { data, error } = await rpc("consume_edge_rate_limit", {
                p_bucket: key,
                p_limit: rule.limit,
                p_window_seconds: rule.windowSec,
            });
            const parsed = rpcRowsSchema.safeParse(data);
            if (error || !parsed.success) {
                console.warn(
                    JSON.stringify({
                        error: error?.message ?? "unexpected_rpc_shape",
                        reason: "rate_limit_rpc_fallback",
                    })
                );
                return fallback(key, rule);
            }

            const row = parsed.data[0]!;
            return row.allowed
                ? { allowed: true }
                : {
                      allowed: false,
                      retryAfterSec: Math.max(1, row.retry_after_sec),
                  };
        },
    };
}
