import { useQuery } from "@tanstack/react-query";

import { resolveCustomFieldsProvider } from "@/features/custom-fields/api/resolve-custom-fields-provider";
import { customFieldKeys } from "@/features/custom-fields/model/query-keys";
import { isGuest } from "@/features/guest-mode";

/** Settings-only: Tasks that have values for Project custom fields. */
export function useCustomFieldValueUsage(projectId: string) {
    const provider = resolveCustomFieldsProvider(isGuest());

    return useQuery({
        enabled: Boolean(projectId),
        queryFn: () => provider.fetchProjectCustomFieldValueUsage(projectId),
        queryKey: customFieldKeys.valueUsage(projectId),
    });
}
