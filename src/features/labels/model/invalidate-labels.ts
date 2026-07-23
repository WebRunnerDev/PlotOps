import type { QueryClient } from "@tanstack/react-query";

import { labelKeys } from "./query-keys";

/** Refresh Project Labels only — not Board columns or Tasks. */
export function invalidateProjectLabels(
    queryClient: QueryClient,
    projectId: string
) {
    void queryClient.invalidateQueries({
        queryKey: labelKeys.project(projectId),
    });
}
