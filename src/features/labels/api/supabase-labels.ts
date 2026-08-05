import type { LabelsProvider } from "@/features/labels/api/labels-provider";

import { fetchProjectLabels } from "@/features/labels/api/labels-api";

/** Real-account Labels adapter — delegates to existing Supabase APIs. */
export const supabaseLabelsProvider: LabelsProvider = {
    fetchProjectLabels,
};
