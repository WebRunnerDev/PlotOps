import type {
    CustomFieldTaskType,
    ProjectCustomField,
} from "@/features/custom-fields/model/types";

/** Max definitions per Project — matches DB trigger (ADR 0024). */
export const CUSTOM_FIELD_DEFINITIONS_CAP = 10;

export const CUSTOM_FIELD_TASK_TYPES: CustomFieldTaskType[] = [
    "bug",
    "feature",
    "task",
];

/** Definitions whose `appliesTo` includes the Task’s current type. */
export function filterCustomFieldsForTaskType(
    fields: ProjectCustomField[],
    taskType: CustomFieldTaskType
): ProjectCustomField[] {
    return fields.filter((field) => field.appliesTo.includes(taskType));
}

export function sortCustomFieldsByPosition(
    fields: ProjectCustomField[]
): ProjectCustomField[] {
    return [...fields].toSorted((a, b) => {
        if (a.position !== b.position) return a.position - b.position;
        return a.name.localeCompare(b.name);
    });
}
