import type { QueryClient } from "@tanstack/react-query";

/**
 * Who the React Query cache currently belongs to. Query keys carry no user
 * id, so the whole cache is scoped to one identity at a time.
 */
export type CacheIdentity = "anon" | "guest" | `user:${string}`;

/**
 * Clears the React Query cache whenever the effective identity changes:
 * user A → B, user → signed out, Guest ↔ account. Without it the next
 * person on the same browser sees the previous one's Projects, Teams and
 * notifications until `gcTime` runs out.
 *
 * Call `sync` with the session user id every time Auth or the Guest Session
 * may have changed; repeated calls with the same identity are no-ops, so a
 * token refresh (same user id, new User object) keeps the cache. The first
 * call only records the identity: nothing has been fetched before Auth boot
 * settles, and boot must not wipe the cache of the user it restores.
 */
export function createIdentityCacheReset(input: {
    isGuest: () => boolean;
    queryClient: Pick<QueryClient, "clear">;
}) {
    let current: CacheIdentity | undefined;

    return {
        sync(userId: null | string): void {
            const next = cacheIdentityOf({ guest: input.isGuest(), userId });
            if (current !== undefined && current !== next) {
                input.queryClient.clear();
            }
            current = next;
        },
    };
}

/** A real user wins over a stale Guest flag: the modes are exclusive (ADR 0018). */
function cacheIdentityOf(input: {
    guest: boolean;
    userId: null | string;
}): CacheIdentity {
    if (input.userId) return `user:${input.userId}`;
    return input.guest ? "guest" : "anon";
}
