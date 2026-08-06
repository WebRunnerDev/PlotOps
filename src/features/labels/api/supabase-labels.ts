import type { LabelsProvider } from "@/features/labels/api/labels-provider";

import {
    createProjectLabel,
    deleteProjectLabel,
    fetchProjectLabels,
    fetchProjectLabelTaggedTasks,
    moveProjectLabel,
    updateProjectLabel,
} from "@/features/labels/api/labels-api";

/** Real-account Labels adapter — delegates to existing Supabase APIs. */
export const supabaseLabelsProvider: LabelsProvider = {
    createProjectLabel,
    deleteProjectLabel,
    fetchProjectLabels,
    fetchProjectLabelTaggedTasks,
    moveProjectLabel,
    updateProjectLabel,
};
