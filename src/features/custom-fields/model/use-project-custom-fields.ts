import type { RealtimeChannel } from "@supabase/supabase-js";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type {
    CustomFieldTaskType,
    ProjectCustomField,
} from "@/features/custom-fields/model/types";

import { resolveCustomFieldsProvider } from "@/features/custom-fields/api/resolve-custom-fields-provider";
import {
    isCustomFieldCapExceeded,
    isUniqueViolation,
} from "@/features/custom-fields/lib/errors";
import {
    invalidateCustomFieldValueUsage,
    invalidateProjectCustomFields,
} from "@/features/custom-fields/model/invalidate-custom-fields";
import { customFieldKeys } from "@/features/custom-fields/model/query-keys";
import { isGuest } from "@/features/guest-mode";
import { supabase } from "@/shared/api/supabase";

const definitionChannels = new Map<
    string,
    { channel: RealtimeChannel; subscribers: number }
>();

export function useProjectCustomFields(projectId: string) {
    const queryClient = useQueryClient();
    const guest = isGuest();
    const provider = resolveCustomFieldsProvider(guest);

    const fieldsQuery = useQuery({
        enabled: Boolean(projectId),
        queryFn: () => provider.fetchProjectCustomFields(projectId),
        queryKey: customFieldKeys.project(projectId),
    });

    useEffect(() => {
        if (!projectId || guest) return;

        return subscribeDefinitionsChannel(projectId, () => {
            invalidateProjectCustomFields(queryClient, projectId);
        });
    }, [guest, projectId, queryClient]);

    const addMutation = useMutation({
        mutationFn: (input: {
            appliesTo: CustomFieldTaskType[];
            name: string;
        }) => provider.createProjectCustomField(projectId, input),
        onSuccess: (field) => {
            queryClient.setQueryData<ProjectCustomField[]>(
                customFieldKeys.project(projectId),
                (current) => {
                    if (!current) return [field];
                    if (current.some((item) => item.id === field.id)) {
                        return current;
                    }
                    return [...current, field];
                }
            );
            invalidateProjectCustomFields(queryClient, projectId);
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({
            fieldId,
            patch,
        }: {
            fieldId: string;
            patch: {
                appliesTo?: CustomFieldTaskType[];
                name?: string;
                position?: number;
            };
        }) => provider.updateProjectCustomField(fieldId, patch),
        onSuccess: () => {
            invalidateProjectCustomFields(queryClient, projectId);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (fieldId: string) =>
            provider.deleteProjectCustomField(fieldId),
        onSuccess: () => {
            invalidateProjectCustomFields(queryClient, projectId);
            invalidateCustomFieldValueUsage(queryClient, projectId);
        },
    });

    const copyMutation = useMutation({
        mutationFn: ({
            fieldId,
            targetProjectId,
        }: {
            fieldId: string;
            targetProjectId: string;
        }) => provider.copyProjectCustomField(fieldId, targetProjectId),
        onSuccess: (_data, variables) => {
            invalidateProjectCustomFields(queryClient, projectId);
            invalidateProjectCustomFields(
                queryClient,
                variables.targetProjectId
            );
        },
    });

    const reorderMutation = useMutation({
        mutationFn: (orderedFieldIds: string[]) =>
            provider.reorderProjectCustomFields(projectId, orderedFieldIds),
        onSuccess: () => {
            invalidateProjectCustomFields(queryClient, projectId);
        },
    });

    const fields = fieldsQuery.data ?? [];

    return {
        addCustomField: async (input: {
            appliesTo: CustomFieldTaskType[];
            name: string;
        }) => {
            try {
                const field = await addMutation.mutateAsync(input);
                return field.id;
            } catch (error) {
                if (isUniqueViolation(error)) return null;
                if (isCustomFieldCapExceeded(error)) return "cap";
                throw error;
            }
        },
        copyCustomFieldToProject: async (
            fieldId: string,
            targetProjectId: string
        ) => {
            const field = fields.find((item) => item.id === fieldId);
            if (!field || field.projectId === targetProjectId) return;
            if (field.systemKey) return;
            try {
                const created = await copyMutation.mutateAsync({
                    fieldId,
                    targetProjectId,
                });
                return created.id;
            } catch (error) {
                if (isUniqueViolation(error)) return null;
                if (isCustomFieldCapExceeded(error)) return "cap";
                throw error;
            }
        },
        deleteCustomField: (fieldId: string) => {
            const field = fields.find((item) => item.id === fieldId);
            if (field?.systemKey) {
                return Promise.reject(
                    new Error("System custom fields cannot be deleted")
                );
            }
            return deleteMutation.mutateAsync(fieldId);
        },
        error: fieldsQuery.error ?? null,
        fields,
        isLoading: fieldsQuery.isLoading,
        refetch: () => fieldsQuery.refetch(),
        renameCustomField: async (fieldId: string, name: string) => {
            const trimmed = name.trim();
            if (!trimmed) return false;
            const duplicate = fields.some(
                (field) =>
                    field.id !== fieldId &&
                    field.name.toLowerCase() === trimmed.toLowerCase()
            );
            if (duplicate) return false;
            try {
                await updateMutation.mutateAsync({
                    fieldId,
                    patch: { name: trimmed },
                });
                return true;
            } catch (error) {
                if (isUniqueViolation(error)) return false;
                throw error;
            }
        },
        reorderCustomFields: (orderedFieldIds: string[]) =>
            reorderMutation.mutateAsync(orderedFieldIds),
        setCustomFieldAppliesTo: (
            fieldId: string,
            appliesTo: CustomFieldTaskType[]
        ) =>
            updateMutation.mutateAsync({
                fieldId,
                patch: { appliesTo },
            }),
    };
}

function releaseDefinitionsChannel(projectId: string) {
    const entry = definitionChannels.get(projectId);
    if (!entry) return;
    entry.subscribers -= 1;
    if (entry.subscribers > 0) return;
    void supabase.removeChannel(entry.channel);
    definitionChannels.delete(projectId);
}

function subscribeDefinitionsChannel(
    projectId: string,
    onChange: () => void
): () => void {
    const existing = definitionChannels.get(projectId);
    if (existing) {
        existing.subscribers += 1;
        return () => releaseDefinitionsChannel(projectId);
    }

    const channel = supabase
        .channel(`custom_field_definitions:${projectId}:${crypto.randomUUID()}`)
        .on(
            "postgres_changes",
            {
                event: "*",
                filter: `project_id=eq.${projectId}`,
                schema: "public",
                table: "custom_field_definitions",
            },
            onChange
        )
        .subscribe();

    definitionChannels.set(projectId, { channel, subscribers: 1 });
    return () => releaseDefinitionsChannel(projectId);
}
