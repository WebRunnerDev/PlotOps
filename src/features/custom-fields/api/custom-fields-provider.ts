import type {
    CustomFieldTaskType,
    CustomFieldValueUsage,
    ProjectCustomField,
    TaskCustomFieldValue,
} from "@/features/custom-fields/model/types";

/**
 * Custom fields data seam for Guest vs Supabase resolution.
 */
export type CustomFieldsProvider = {
    /** Copy definition (+ appliesTo) into another Project — no Task values. */
    copyProjectCustomField(
        fieldId: string,
        targetProjectId: string
    ): Promise<ProjectCustomField>;
    createProjectCustomField(
        projectId: string,
        input: {
            appliesTo: CustomFieldTaskType[];
            name: string;
            position?: number;
        }
    ): Promise<ProjectCustomField>;
    deleteProjectCustomField(fieldId: string): Promise<void>;
    fetchProjectCustomFields(projectId: string): Promise<ProjectCustomField[]>;
    fetchProjectCustomFieldValueUsage(
        projectId: string
    ): Promise<CustomFieldValueUsage[]>;
    fetchTaskCustomFieldValues(taskId: string): Promise<TaskCustomFieldValue[]>;
    reorderProjectCustomFields(
        projectId: string,
        orderedFieldIds: string[]
    ): Promise<void>;
    updateProjectCustomField(
        fieldId: string,
        patch: {
            appliesTo?: CustomFieldTaskType[];
            name?: string;
            position?: number;
        }
    ): Promise<void>;
    /**
     * Upsert text value. Empty / whitespace-only clears the row (delete).
     */
    upsertTaskCustomFieldValue(
        taskId: string,
        fieldId: string,
        value: string
    ): Promise<void>;
};
