export type RateLimitAllowed = {
    allowed: true;
    remaining: number;
    resetAtMs: number;
};

export type RateLimitBlocked = {
    allowed: false;
    retryAfterSec: number;
    resetAtMs: number;
};

export type RateLimitResult = RateLimitAllowed | RateLimitBlocked;

export type SlidingWindowRateLimiter = {
    check(key: string, nowMs?: number): RateLimitResult;
};

/** In-memory sliding window — per Edge Function isolate; not global across instances. */
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
                    retryAfterSec: Math.max(
                        1,
                        Math.ceil((resetAtMs - nowMs) / 1000)
                    ),
                    resetAtMs,
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
