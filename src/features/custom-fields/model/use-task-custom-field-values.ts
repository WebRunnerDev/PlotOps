import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { resolveCustomFieldsProvider } from "@/features/custom-fields/api/resolve-custom-fields-provider";
import { invalidateTaskCustomFieldValues } from "@/features/custom-fields/model/invalidate-custom-fields";
import { customFieldKeys } from "@/features/custom-fields/model/query-keys";
import { isGuest } from "@/features/guest-mode";

/** Task drawer: load + upsert custom field values. */
export function useTaskCustomFieldValues(taskId: string) {
    const queryClient = useQueryClient();
    const provider = resolveCustomFieldsProvider(isGuest());

    const valuesQuery = useQuery({
        enabled: Boolean(taskId),
        queryFn: () => provider.fetchTaskCustomFieldValues(taskId),
        queryKey: customFieldKeys.taskValues(taskId),
    });

    const upsertMutation = useMutation({
        mutationFn: ({ fieldId, value }: { fieldId: string; value: string }) =>
            provider.upsertTaskCustomFieldValue(taskId, fieldId, value),
        onSuccess: () => {
            invalidateTaskCustomFieldValues(queryClient, taskId);
        },
    });

    const values = valuesQuery.data ?? [];
    const valueByFieldId = new Map(
        values.map((row) => [row.fieldId, row.value] as const)
    );

    return {
        error: valuesQuery.error ?? null,
        isLoading: valuesQuery.isLoading,
        refetch: () => valuesQuery.refetch(),
        setCustomFieldValue: (fieldId: string, value: string) =>
            upsertMutation.mutateAsync({ fieldId, value }),
        valueByFieldId,
        values,
    };
}
