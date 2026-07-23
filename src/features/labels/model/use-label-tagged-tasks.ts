import { useQuery } from "@tanstack/react-query";

import { fetchProjectLabelTaggedTasks } from "@/features/labels/api/labels-api";
import { labelKeys } from "@/features/labels/model/query-keys";

/** Settings-only: Tasks that reference Project Labels (usage counts / delete guards). */
export function useLabelTaggedTasks(projectId: string) {
    return useQuery({
        enabled: Boolean(projectId),
        queryFn: () => fetchProjectLabelTaggedTasks(projectId),
        queryKey: labelKeys.taggedTasks(projectId),
    });
}
