import type { LabelsProvider } from "@/features/labels/api/labels-provider";
import type { LabelColor, ProjectLabel } from "@/features/labels/model/types";

import { getGuestSandbox } from "@/features/guest-mode";

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

/** Guest Mode Labels adapter — reads the local sandbox; never calls Supabase. */
export const guestLabelsProvider: LabelsProvider = {
    async fetchProjectLabels(projectId) {
        const sandbox = getGuestSandbox();
        if (!sandbox) {
            throw new Error("No Guest Session");
        }
        return sandbox.labels
            .filter((label) => label.projectId === projectId)
            .map((label): ProjectLabel => ({
                color: LABEL_COLORS.has(label.color)
                    ? (label.color as LabelColor)
                    : "gray",
                id: label.id,
                name: label.name,
                projectId: label.projectId,
            }))
            .toSorted((a, b) => a.name.localeCompare(b.name));
    },
};
