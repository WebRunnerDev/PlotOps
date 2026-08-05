import type { ProjectLabel } from "@/features/labels/model/types";

/**
 * Narrow Labels read seam so Board chrome resolves Guest vs Supabase once.
 */
export type LabelsProvider = {
    fetchProjectLabels(projectId: string): Promise<ProjectLabel[]>;
};
