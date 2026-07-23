import type { QueryClient } from "@tanstack/react-query";

import { boardKeys } from "./query-keys";

/** Refresh Board columns for a Project — not Board list, Labels, or Tasks. */
export function invalidateBoardColumns(
    queryClient: QueryClient,
    projectId: string
) {
    void queryClient.invalidateQueries({
        queryKey: [...boardKeys.all, "columns", projectId],
    });
}

/** Refresh Project Board list only — not columns or Tasks. */
export function invalidateProjectBoards(
    queryClient: QueryClient,
    projectId: string
) {
    void queryClient.invalidateQueries({
        queryKey: boardKeys.list(projectId),
    });
}
