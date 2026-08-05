import type { RealtimeChannel } from "@supabase/supabase-js";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { LabelColor, ProjectLabel } from "@/features/labels/model/types";

import { isGuest } from "@/features/guest-mode";
import {
    createProjectLabel,
    deleteProjectLabel,
    moveProjectLabel,
    updateProjectLabel,
} from "@/features/labels/api/labels-api";
import { resolveLabelsProvider } from "@/features/labels/api/resolve-labels-provider";
import { isUniqueViolation } from "@/features/labels/lib/is-unique-violation";
import { LABEL_COLORS } from "@/features/labels/model/constants";
import {
    invalidateProjectLabels,
    stripLabelIdFromTaskCaches,
} from "@/features/labels/model/invalidate-labels";
import { labelKeys } from "@/features/labels/model/query-keys";
import { supabase } from "@/shared/api/supabase";

/** Ref-count Realtime channels so multiple mounts share one `labels` subscription. */
const labelChannels = new Map<
    string,
    { channel: RealtimeChannel; subscribers: number }
>();

export function useProjectLabels(projectId: string) {
    const queryClient = useQueryClient();
    const guest = isGuest();
    const labelsProvider = resolveLabelsProvider(guest);

    const labelsQuery = useQuery({
        enabled: Boolean(projectId),
        queryFn: () => labelsProvider.fetchProjectLabels(projectId),
        queryKey: labelKeys.project(projectId),
    });

    useEffect(() => {
        if (!projectId || guest) return;

        return subscribeLabelsChannel(projectId, () => {
            invalidateProjectLabels(queryClient, projectId);
        });
    }, [guest, projectId, queryClient]);

    const addLabelMutation = useMutation({
        mutationFn: ({
            color,
            customColor,
            name,
        }: {
            color?: LabelColor;
            customColor?: string;
            name: string;
        }) => {
            if (guest) {
                throw new Error(
                    "Creating labels is not available in Guest Mode"
                );
            }
            const projectLabels = labelsQuery.data ?? [];
            const nextColor =
                color ??
                LABEL_COLORS[projectLabels.length % LABEL_COLORS.length]!;
            return createProjectLabel(projectId, name, nextColor, customColor);
        },
        onSuccess: (label) => {
            queryClient.setQueryData<ProjectLabel[]>(
                labelKeys.project(projectId),
                (current) => {
                    if (!current) return [label];
                    if (current.some((item) => item.id === label.id)) {
                        return current;
                    }
                    return [...current, label];
                }
            );
            invalidateProjectLabels(queryClient, projectId);
        },
    });

    const renameLabelMutation = useMutation({
        mutationFn: ({ labelId, name }: { labelId: string; name: string }) =>
            updateProjectLabel(labelId, { name }),
        onSuccess: () => {
            invalidateProjectLabels(queryClient, projectId);
        },
    });

    const updateLabelColorMutation = useMutation({
        mutationFn: ({
            color,
            labelId,
        }: {
            color: LabelColor;
            labelId: string;
        }) => updateProjectLabel(labelId, { color, custom_color: null }),
        onSuccess: () => {
            invalidateProjectLabels(queryClient, projectId);
        },
    });

    const setLabelCustomColorMutation = useMutation({
        mutationFn: ({ hex, labelId }: { hex: string; labelId: string }) =>
            updateProjectLabel(labelId, { custom_color: hex }),
        onSuccess: () => {
            invalidateProjectLabels(queryClient, projectId);
        },
    });

    const deleteLabelMutation = useMutation({
        mutationFn: (labelId: string) => deleteProjectLabel(labelId),
        onSuccess: (_data, labelId) => {
            stripLabelIdFromTaskCaches(queryClient, projectId, labelId);
            invalidateProjectLabels(queryClient, projectId);
            void queryClient.invalidateQueries({
                queryKey: labelKeys.taggedTasks(projectId),
            });
        },
    });

    const copyLabelMutation = useMutation({
        mutationFn: ({
            label,
            targetProjectId,
        }: {
            label: ProjectLabel;
            targetProjectId: string;
        }) =>
            createProjectLabel(
                targetProjectId,
                label.name,
                label.color,
                label.customColor
            ),
        onSuccess: (_data, variables) => {
            invalidateProjectLabels(queryClient, projectId);
            invalidateProjectLabels(queryClient, variables.targetProjectId);
        },
    });

    const moveLabelMutation = useMutation({
        mutationFn: async ({
            label,
            targetProjectId,
        }: {
            label: ProjectLabel;
            targetProjectId: string;
        }) => {
            await moveProjectLabel(label.id, targetProjectId);
        },
        onSuccess: (_data, variables) => {
            stripLabelIdFromTaskCaches(
                queryClient,
                projectId,
                variables.label.id
            );
            invalidateProjectLabels(queryClient, projectId);
            invalidateProjectLabels(queryClient, variables.targetProjectId);
            void queryClient.invalidateQueries({
                queryKey: labelKeys.taggedTasks(projectId),
            });
        },
    });

    const labels = labelsQuery.data ?? [];

    return {
        addLabel: async (
            name: string,
            color?: LabelColor,
            customColor?: string
        ) => {
            try {
                const label = await addLabelMutation.mutateAsync({
                    color,
                    customColor,
                    name,
                });
                return label.id;
            } catch (error) {
                if (isUniqueViolation(error)) return null;
                throw error;
            }
        },
        copyLabelToProject: async (
            labelId: string,
            targetProjectId: string
        ) => {
            const label = labels.find((item) => item.id === labelId);
            if (!label || label.projectId === targetProjectId) return;
            try {
                const created = await copyLabelMutation.mutateAsync({
                    label,
                    targetProjectId,
                });
                return created.id;
            } catch (error) {
                if (isUniqueViolation(error)) return null;
                throw error;
            }
        },
        deleteLabel: (labelId: string) =>
            deleteLabelMutation.mutateAsync(labelId),
        error: labelsQuery.error ?? null,
        isLoading: labelsQuery.isLoading,
        labels,
        moveLabelToProject: async (
            labelId: string,
            targetProjectId: string
        ) => {
            const label = labels.find((item) => item.id === labelId);
            if (!label || label.projectId === targetProjectId) return;
            try {
                await moveLabelMutation.mutateAsync({ label, targetProjectId });
            } catch (error) {
                if (isUniqueViolation(error)) return null;
                throw error;
            }
        },
        refetch: () => labelsQuery.refetch(),
        renameLabel: async (labelId: string, name: string) => {
            const trimmed = name.trim();
            if (!trimmed) return false;
            const duplicate = labels.some(
                (label) =>
                    label.id !== labelId &&
                    label.name.toLowerCase() === trimmed.toLowerCase()
            );
            if (duplicate) return false;
            try {
                await renameLabelMutation.mutateAsync({
                    labelId,
                    name: trimmed,
                });
                return true;
            } catch (error) {
                if (isUniqueViolation(error)) return false;
                throw error;
            }
        },
        setLabelCustomColor: (labelId: string, hex: string) =>
            setLabelCustomColorMutation.mutateAsync({ hex, labelId }),
        updateLabelColor: (labelId: string, color: LabelColor) =>
            updateLabelColorMutation.mutateAsync({ color, labelId }),
    };
}

function releaseLabelsChannel(projectId: string) {
    const entry = labelChannels.get(projectId);
    if (!entry) return;
    entry.subscribers -= 1;
    if (entry.subscribers > 0) return;
    void supabase.removeChannel(entry.channel);
    labelChannels.delete(projectId);
}

function subscribeLabelsChannel(
    projectId: string,
    onLabelsChange: () => void
): () => void {
    const existing = labelChannels.get(projectId);
    if (existing) {
        existing.subscribers += 1;
        return () => releaseLabelsChannel(projectId);
    }

    const channel = supabase
        .channel(`labels:${projectId}:${crypto.randomUUID()}`)
        .on(
            "postgres_changes",
            {
                event: "*",
                filter: `project_id=eq.${projectId}`,
                schema: "public",
                table: "labels",
            },
            onLabelsChange
        )
        .subscribe();

    labelChannels.set(projectId, { channel, subscribers: 1 });
    return () => releaseLabelsChannel(projectId);
}
