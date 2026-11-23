import { QueryClient } from "@tanstack/react-query";

import { createAppRouter } from "./create-app-router";

/**
 * Data a query fetched counts as fresh for 30 s. With TanStack's default of 0,
 * every remount and every return to the tab refetched every active query,
 * which with many tabs open means a burst of requests on each focus.
 *
 * Realtime-backed data (Tasks, columns, Labels, custom fields, notifications)
 * stays current through explicit invalidation, which ignores `staleTime`.
 * A tab hidden longer than 30 s still refetches on focus, which also heals
 * Realtime events missed while the socket was asleep.
 */
const DEFAULT_QUERY_STALE_TIME_MS = 30_000;

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: DEFAULT_QUERY_STALE_TIME_MS,
        },
    },
});

export const router = createAppRouter(queryClient);
