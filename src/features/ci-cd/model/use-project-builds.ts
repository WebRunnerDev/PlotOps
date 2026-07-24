import { useQuery } from "@tanstack/react-query";

import type { BuildsForProject } from "@/features/ci-cd/model/types";

import { mockBuildsForProject } from "@/features/ci-cd/api/mock-builds";
import { ciKeys } from "@/features/ci-cd/model/query-keys";

/** Default provider — swap for GitHub Actions later at this seam. */
const buildsProvider: BuildsForProject = mockBuildsForProject;

export function useProjectBuilds(projectId: string) {
    return useQuery({
        enabled: Boolean(projectId),
        queryFn: () => buildsProvider.listBuilds(projectId),
        queryKey: ciKeys.builds(projectId),
        staleTime: 30_000,
    });
}
