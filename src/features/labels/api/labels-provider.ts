import type { LabelsProvider } from "@/features/labels/api/labels-provider";
import type {
    LabelColor,
    LabelTaggedTask,
    ProjectLabel,
} from "@/features/labels/model/types";

/**
 * Labels data seam for Guest vs Supabase resolution.
 * Board chrome reads + settings mutations against the local sandbox in Guest Mode.
 */
export type LabelsProvider = {
    createProjectLabel(
        projectId: string,
        name: string,
        color: LabelColor,
        customColor?: string
    ): Promise<ProjectLabel>;
    deleteProjectLabel(labelId: string): Promise<void>;
    fetchProjectLabels(projectId: string): Promise<ProjectLabel[]>;
    fetchProjectLabelTaggedTasks(projectId: string): Promise<LabelTaggedTask[]>;
    moveProjectLabel(labelId: string, targetProjectId: string): Promise<void>;
    updateProjectLabel(
        labelId: string,
        patch: {
            color?: LabelColor;
            custom_color?: null | string;
            name?: string;
            project_id?: string;
        }
    ): Promise<void>;
};
