import type { QueryClient } from "@tanstack/react-query";

import { gitKeys } from "./query-keys";

/** Drop all GitHub-backed React Query caches (sign-out / token clear). */
export function clearGitQueryCache(queryClient: QueryClient) {
    queryClient.removeQueries({ queryKey: gitKeys.all });
}
