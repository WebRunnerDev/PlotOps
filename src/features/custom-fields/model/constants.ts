import type {
    CustomFieldSystemKey,
    CustomFieldTaskType,
    ProjectCustomField,
} from "@/features/custom-fields/model/types";

/** Max non-system definitions per Project — matches DB trigger (ADR 0024). */
export const CUSTOM_FIELD_DEFINITIONS_CAP = 10;

/** Max plain-text value length — matches DB check (ADR 0024). */
export const CUSTOM_FIELD_VALUE_MAX_LENGTH = 8192;

export const CUSTOM_FIELD_TASK_TYPES: CustomFieldTaskType[] = [
    "bug",
    "feature",
    "task",
];

export const DESCRIPTION_SYSTEM_KEY: CustomFieldSystemKey = "description";

/** Count toward the ≤10 cap (excludes Description and other system rows). */
export function countCapCustomFields(fields: ProjectCustomField[]): number {
    return fields.filter((field) => !isSystemCustomField(field)).length;
}

/** Definitions whose `appliesTo` includes the Task’s current type. */
export function filterCustomFieldsForTaskType(
    fields: ProjectCustomField[],
    taskType: CustomFieldTaskType
): ProjectCustomField[] {
    return fields.filter((field) => field.appliesTo.includes(taskType));
}

export function isDescriptionCustomField(field: ProjectCustomField): boolean {
    return field.systemKey === DESCRIPTION_SYSTEM_KEY;
}

export function isSystemCustomField(field: ProjectCustomField): boolean {
    return field.systemKey != undefined;
}

export function sortCustomFieldsByPosition(
    fields: ProjectCustomField[]
): ProjectCustomField[] {
    return [...fields].toSorted((a, b) => {
        if (a.position !== b.position) return a.position - b.position;
        return a.name.localeCompare(b.name);
    });
}
