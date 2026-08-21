/** Built-in Task type — mirrors `public.task_type` / tasks.TaskType. */
export type CustomFieldTaskType = "bug" | "feature" | "task";

/** Minimal Task ref for Settings usage (delete confirm / counts). */
export type CustomFieldValueUsage = {
    archivedAt?: string;
    fieldId: string;
    taskId: string;
    taskKey: string;
    title: string;
};

/** Project-scoped custom text field definition (ADR 0024). */
export type ProjectCustomField = {
    appliesTo: CustomFieldTaskType[];
    id: string;
    name: string;
    position: number;
    projectId: string;
};

/** Stored value for one definition on one Task. */
export type TaskCustomFieldValue = {
    fieldId: string;
    taskId: string;
    value: string;
};
