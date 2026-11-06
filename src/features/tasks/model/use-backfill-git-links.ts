import { useMutation, useQueryClient } from "@tanstack/react-query";

import { backfillGitLinks } from "@/features/git-integration/api/backfill-git-links-api";
import { taskKeys } from "@/features/tasks/model/query-keys";

/**
 * Drawer «Refresh» in the GitHub block: link open PRs and branches with a
 * task key across the Project's Repositories, then reload Tasks.
 */
export function useBackfillGitLinks(projectId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => backfillGitLinks(projectId),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: taskKeys.all });
        },
    });
}
