import { useQuery } from "@tanstack/react-query";

import { isGuest } from "@/features/guest-mode";
import { resolveLabelsProvider } from "@/features/labels/api/resolve-labels-provider";
import { labelKeys } from "@/features/labels/model/query-keys";

/** Settings-only: Tasks that reference Project Labels (usage counts / delete guards). */
export function useLabelTaggedTasks(projectId: string) {
    const provider = resolveLabelsProvider(isGuest());

    return useQuery({
        enabled: Boolean(projectId),
        queryFn: () => provider.fetchProjectLabelTaggedTasks(projectId),
        queryKey: labelKeys.taggedTasks(projectId),
    });
}
