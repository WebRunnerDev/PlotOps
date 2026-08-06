import type { GuestLabel } from "@/features/guest-mode";
import type { LabelsProvider } from "@/features/labels/api/labels-provider";
import type {
    LabelColor,
    LabelTaggedTask,
    ProjectLabel,
} from "@/features/labels/model/types";

import { getGuestSandbox, updateGuestSandbox } from "@/features/guest-mode";

const LABEL_COLORS = new Set<string>([
    "amber",
    "blue",
    "cyan",
    "gray",
    "green",
    "orange",
    "pink",
    "purple",
    "red",
]);

function assertUniqueName(
    labels: GuestLabel[],
    projectId: string,
    name: string,
    exceptId?: string
) {
    const normalized = name.toLowerCase();
    const duplicate = labels.some(
        (label) =>
            label.projectId === projectId &&
            label.id !== exceptId &&
            label.name.toLowerCase() === normalized
    );
    if (duplicate) {
        const error = new Error(
            "duplicate key value violates unique constraint"
        );
        (error as Error & { code?: string }).code = "23505";
        throw error;
    }
}

function mapLabel(label: GuestLabel): ProjectLabel {
    return {
        color: LABEL_COLORS.has(label.color)
            ? (label.color as LabelColor)
            : "gray",
        ...(label.customColor ? { customColor: label.customColor } : {}),
        id: label.id,
        name: label.name,
        projectId: label.projectId,
    };
}

function normalizeLabelName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
        throw new Error("Label name is required");
    }
    return trimmed;
}

function requireLabel(labels: GuestLabel[], labelId: string): GuestLabel {
    const label = labels.find((item) => item.id === labelId);
    if (!label) {
        throw new Error("Label not found");
    }
    return label;
}

/** Guest Mode Labels adapter — reads/writes the local sandbox; never calls Supabase. */
export const guestLabelsProvider: LabelsProvider = {
    async createProjectLabel(projectId, name, color, customColor) {
        const normalizedName = normalizeLabelName(name);
        let created: GuestLabel | undefined;

        updateGuestSandbox((sandbox) => {
            assertUniqueName(sandbox.labels, projectId, normalizedName);
            created = {
                color,
                ...(customColor ? { customColor } : {}),
                id: crypto.randomUUID(),
                name: normalizedName,
                projectId,
            };
            sandbox.labels.push(created);
        });

        if (!created) {
            throw new Error("Failed to create label");
        }
        return mapLabel(created);
    },

    async deleteProjectLabel(labelId) {
        updateGuestSandbox((sandbox) => {
            const index = sandbox.labels.findIndex(
                (label) => label.id === labelId
            );
            if (index === -1) {
                throw new Error("Label not found");
            }
            sandbox.labels.splice(index, 1);
            for (const task of sandbox.tasks) {
                if (!task.labelIds?.includes(labelId)) continue;
                const next = task.labelIds.filter((id) => id !== labelId);
                task.labelIds = next.length > 0 ? next : undefined;
            }
        });
    },

    async fetchProjectLabels(projectId) {
        const sandbox = getGuestSandbox();
        if (!sandbox) {
            throw new Error("No Guest Session");
        }
        return sandbox.labels
            .filter((label) => label.projectId === projectId)
            .map((label) => mapLabel(label))
            .toSorted((a, b) => a.name.localeCompare(b.name));
    },

    async fetchProjectLabelTaggedTasks(projectId) {
        const sandbox = getGuestSandbox();
        if (!sandbox) {
            throw new Error("No Guest Session");
        }
        return sandbox.tasks
            .filter(
                (task) =>
                    task.projectId === projectId &&
                    (task.labelIds?.length ?? 0) > 0
            )
            .map((task): LabelTaggedTask => ({
                archivedAt: task.archivedAt,
                id: task.id,
                key: task.key,
                labelIds: [...(task.labelIds ?? [])],
                title: task.title,
            }));
    },

    async moveProjectLabel(labelId, targetProjectId) {
        updateGuestSandbox((sandbox) => {
            const label = requireLabel(sandbox.labels, labelId);
            if (label.projectId === targetProjectId) {
                return;
            }
            assertUniqueName(sandbox.labels, targetProjectId, label.name);
            label.projectId = targetProjectId;
        });
    },

    async updateProjectLabel(labelId, patch) {
        updateGuestSandbox((sandbox) => {
            const label = requireLabel(sandbox.labels, labelId);
            if (patch.name !== undefined) {
                const normalizedName = normalizeLabelName(patch.name);
                assertUniqueName(
                    sandbox.labels,
                    label.projectId,
                    normalizedName,
                    label.id
                );
                label.name = normalizedName;
            }
            if (patch.color !== undefined) {
                label.color = patch.color;
            }
            if (patch.custom_color !== undefined) {
                if (patch.custom_color === null) {
                    delete label.customColor;
                } else {
                    label.customColor = patch.custom_color;
                }
            }
            if (patch.project_id !== undefined) {
                if (patch.project_id !== label.projectId) {
                    assertUniqueName(
                        sandbox.labels,
                        patch.project_id,
                        label.name,
                        label.id
                    );
                }
                label.projectId = patch.project_id;
            }
        });
    },
};
