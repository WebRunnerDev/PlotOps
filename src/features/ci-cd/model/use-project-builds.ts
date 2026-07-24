import { useQuery } from "@tanstack/react-query";

import { buildsProvider } from "@/features/ci-cd/api/builds-provider";
import { ciKeys } from "@/features/ci-cd/model/query-keys";

export function useProjectBuilds(projectId: string) {
    return useQuery({
        enabled: Boolean(projectId),
        queryFn: () => buildsProvider.listBuilds(projectId),
        queryKey: ciKeys.builds(projectId),
        staleTime: 30_000,
    });
}
