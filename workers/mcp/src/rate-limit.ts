/** Rate limiting for the MCP Worker: Cloudflare binding + in-memory fallback. */

export type RateLimitAllowed = {
    allowed: true;
    remaining: number;
    resetAtMs: number;
};

/**
 * Cloudflare Workers Rate Limiting binding (`[[ratelimits]]` in wrangler.toml).
 * Counters are shared per Cloudflare location, not per isolate, and cost no
 * database round-trip.
 */
export type RateLimitBinding = {
    limit(options: { key: string }): Promise<{ success: boolean }>;
};

export type RateLimitBlocked = {
    allowed: false;
    resetAtMs: number;
    retryAfterSec: number;
};

export type RateLimitResult = RateLimitAllowed | RateLimitBlocked;

export type SlidingWindowRateLimiter = {
    check(key: string, nowMs?: number): RateLimitResult;
};

/**
 * Prefer the binding; fall back to the per-isolate window when the binding is
 * absent (unit tests) or errors, so a limiter outage never fails open or
 * blocks every request.
 */
export async function checkRateLimit(
    binding: RateLimitBinding | undefined,
    fallback: SlidingWindowRateLimiter,
    key: string
): Promise<boolean> {
    if (binding) {
        try {
            const { success } = await binding.limit({ key });
            return success;
        } catch {
            // fall through to the in-memory window
        }
    }
    return fallback.check(key).allowed;
}

export function createSlidingWindowRateLimiter(options: {
    limit: number;
    windowMs: number;
}): SlidingWindowRateLimiter {
    const hits = new Map<string, number[]>();
    const { limit, windowMs } = options;

    return {
        check(key: string, nowMs = Date.now()): RateLimitResult {
            const windowStart = nowMs - windowMs;
            const timestamps = (hits.get(key) ?? []).filter(
                (timestamp) => timestamp > windowStart
            );

            if (timestamps.length >= limit) {
                const oldest = timestamps[0]!;
                const resetAtMs = oldest + windowMs;
                return {
                    allowed: false,
                    resetAtMs,
                    retryAfterSec: Math.max(
                        1,
                        Math.ceil((resetAtMs - nowMs) / 1000)
                    ),
                };
            }

            timestamps.push(nowMs);
            hits.set(key, timestamps);

            return {
                allowed: true,
                remaining: limit - timestamps.length,
                resetAtMs: nowMs + windowMs,
            };
        },
    };
}
