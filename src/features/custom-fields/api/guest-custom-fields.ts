import type { CustomFieldsProvider } from "@/features/custom-fields/api/custom-fields-provider";
import type {
    CustomFieldTaskType,
    CustomFieldValueUsage,
    ProjectCustomField,
    TaskCustomFieldValue,
} from "@/features/custom-fields/model/types";
import type { GuestCustomFieldDefinition } from "@/features/guest-mode";

import {
    countCapCustomFields,
    CUSTOM_FIELD_DEFINITIONS_CAP,
    CUSTOM_FIELD_VALUE_MAX_LENGTH,
    isSystemCustomField,
    sortCustomFieldsByPosition,
} from "@/features/custom-fields/model/constants";
import { getGuestSandbox, updateGuestSandbox } from "@/features/guest-mode";

function assertCap(
    definitions: GuestCustomFieldDefinition[],
    projectId: string
) {
    const count = countCapCustomFields(
        definitions
            .filter((field) => field.projectId === projectId)
            .map((field) => mapDefinition(field))
    );
    if (count >= CUSTOM_FIELD_DEFINITIONS_CAP) {
        const error = new Error(
            "A Project may have at most 10 custom field definitions"
        );
        (error as Error & { code?: string }).code = "P0001";
        throw error;
    }
}

function assertUniqueName(
    definitions: GuestCustomFieldDefinition[],
    projectId: string,
    name: string,
    exceptId?: string
) {
    const normalized = name.toLowerCase();
    const duplicate = definitions.some(
        (field) =>
            field.projectId === projectId &&
            field.id !== exceptId &&
            field.name.toLowerCase() === normalized
    );
    if (duplicate) {
        const error = new Error(
            "duplicate key value violates unique constraint"
        );
        (error as Error & { code?: string }).code = "23505";
        throw error;
    }
}

function mapDefinition(field: GuestCustomFieldDefinition): ProjectCustomField {
    return {
        appliesTo: [...field.appliesTo],
        id: field.id,
        name: field.name,
        position: field.position,
        projectId: field.projectId,
        systemKey: field.systemKey,
    };
}

function normalizeAppliesTo(
    appliesTo: CustomFieldTaskType[]
): CustomFieldTaskType[] {
    const unique = [...new Set(appliesTo)];
    if (unique.length === 0) {
        throw new Error("Custom field must apply to at least one Task type");
    }
    return unique;
}

function normalizeName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
        throw new Error("Custom field name is required");
    }
    return trimmed;
}

function requireDefinition(
    definitions: GuestCustomFieldDefinition[],
    fieldId: string
): GuestCustomFieldDefinition {
    const field = definitions.find((item) => item.id === fieldId);
    if (!field) {
        throw new Error("Custom field definition not found");
    }
    return field;
}

/** Guest Mode custom fields adapter — local sandbox only. */
export const guestCustomFieldsProvider: CustomFieldsProvider = {
    async copyProjectCustomField(fieldId, targetProjectId) {
        const sandbox = getGuestSandbox();
        if (!sandbox) throw new Error("No Guest Session");
        const source = requireDefinition(
            sandbox.customFieldDefinitions,
            fieldId
        );
        if (source.systemKey) {
            throw new Error("System custom fields cannot be copied");
        }
        return guestCustomFieldsProvider.createProjectCustomField(
            targetProjectId,
            {
                appliesTo: source.appliesTo,
                name: source.name,
            }
        );
    },

    async createProjectCustomField(projectId, input) {
        const normalizedName = normalizeName(input.name);
        const appliesTo = normalizeAppliesTo(input.appliesTo);
        let created: GuestCustomFieldDefinition | undefined;

        updateGuestSandbox((sandbox) => {
            assertCap(sandbox.customFieldDefinitions, projectId);
            assertUniqueName(
                sandbox.customFieldDefinitions,
                projectId,
                normalizedName
            );
            const siblings = sandbox.customFieldDefinitions.filter(
                (field) => field.projectId === projectId
            );
            const position =
                input.position ??
                (siblings.length === 0
                    ? 0
                    : Math.max(...siblings.map((field) => field.position)) + 1);
            created = {
                appliesTo,
                id: crypto.randomUUID(),
                name: normalizedName,
                position,
                projectId,
            };
            sandbox.customFieldDefinitions.push(created);
        });

        if (!created) throw new Error("Failed to create custom field");
        return mapDefinition(created);
    },

    async deleteProjectCustomField(fieldId) {
        updateGuestSandbox((sandbox) => {
            const index = sandbox.customFieldDefinitions.findIndex(
                (field) => field.id === fieldId
            );
            if (index === -1) {
                throw new Error("Custom field definition not found");
            }
            const field = sandbox.customFieldDefinitions[index]!;
            if (field.systemKey) {
                throw new Error("System custom fields cannot be deleted");
            }
            sandbox.customFieldDefinitions.splice(index, 1);
            sandbox.customFieldValues = sandbox.customFieldValues.filter(
                (value) => value.fieldId !== fieldId
            );
        });
    },

    async fetchProjectCustomFields(projectId) {
        const sandbox = getGuestSandbox();
        if (!sandbox) throw new Error("No Guest Session");
        return sortCustomFieldsByPosition(
            sandbox.customFieldDefinitions
                .filter((field) => field.projectId === projectId)
                .map((field) => mapDefinition(field))
        );
    },

    async fetchProjectCustomFieldValueUsage(projectId) {
        const sandbox = getGuestSandbox();
        if (!sandbox) throw new Error("No Guest Session");
        const fieldIds = new Set(
            sandbox.customFieldDefinitions
                .filter(
                    (field) => field.projectId === projectId && !field.systemKey
                )
                .map((field) => field.id)
        );
        const usage: CustomFieldValueUsage[] = [];
        for (const value of sandbox.customFieldValues) {
            if (!fieldIds.has(value.fieldId)) continue;
            const task = sandbox.tasks.find((item) => item.id === value.taskId);
            if (!task || task.projectId !== projectId) continue;
            usage.push({
                archivedAt: task.archivedAt,
                fieldId: value.fieldId,
                taskId: task.id,
                taskKey: task.key,
                title: task.title,
            });
        }
        return usage;
    },

    async fetchTaskCustomFieldValues(taskId) {
        const sandbox = getGuestSandbox();
        if (!sandbox) throw new Error("No Guest Session");
        return sandbox.customFieldValues
            .filter((value) => value.taskId === taskId)
            .map((value): TaskCustomFieldValue => ({
                fieldId: value.fieldId,
                taskId: value.taskId,
                value: value.value,
            }));
    },

    async reorderProjectCustomFields(projectId, orderedFieldIds) {
        updateGuestSandbox((sandbox) => {
            const byId = new Map(
                sandbox.customFieldDefinitions
                    .filter((field) => field.projectId === projectId)
                    .map((field) => [field.id, field])
            );
            for (const [index, fieldId] of orderedFieldIds.entries()) {
                const field = byId.get(fieldId);
                if (field) field.position = index;
            }
        });
    },

    async updateProjectCustomField(fieldId, patch) {
        updateGuestSandbox((sandbox) => {
            const field = requireDefinition(
                sandbox.customFieldDefinitions,
                fieldId
            );
            if (patch.name !== undefined) {
                const normalizedName = normalizeName(patch.name);
                assertUniqueName(
                    sandbox.customFieldDefinitions,
                    field.projectId,
                    normalizedName,
                    field.id
                );
                field.name = normalizedName;
            }
            if (patch.appliesTo !== undefined) {
                field.appliesTo = normalizeAppliesTo(patch.appliesTo);
            }
            if (patch.position !== undefined) {
                field.position = patch.position;
            }
        });
    },

    async upsertTaskCustomFieldValue(taskId, fieldId, value) {
        if (value.length > CUSTOM_FIELD_VALUE_MAX_LENGTH) {
            throw new Error("Custom field value exceeds maximum length");
        }
        const trimmed = value.trim();
        updateGuestSandbox((sandbox) => {
            const task = sandbox.tasks.find((item) => item.id === taskId);
            if (!task) throw new Error("Task not found");
            if (task.archivedAt) {
                throw new Error(
                    "Cannot edit custom fields on an archived Task"
                );
            }
            const field = requireDefinition(
                sandbox.customFieldDefinitions,
                fieldId
            );
            if (isSystemCustomField(mapDefinition(field))) {
                throw new Error(
                    "System custom fields do not store values in task_custom_field_values"
                );
            }
            if (field.projectId !== task.projectId) {
                throw new Error(
                    "Custom field values must stay inside the same Project"
                );
            }

            const index = sandbox.customFieldValues.findIndex(
                (row) => row.taskId === taskId && row.fieldId === fieldId
            );
            if (trimmed === "") {
                if (index !== -1) {
                    sandbox.customFieldValues.splice(index, 1);
                }
                return;
            }
            if (index === -1) {
                sandbox.customFieldValues.push({
                    fieldId,
                    taskId,
                    value: trimmed,
                });
            } else {
                sandbox.customFieldValues[index]!.value = trimmed;
            }
        });
    },
};
