import type {
    CustomFieldTaskType,
    ProjectCustomField,
} from "@/features/custom-fields/model/types";

export type DatabaseCustomFieldDefinition = {
    applies_to: CustomFieldTaskType[];
    id: string;
    name: string;
    position: number;
    project_id: string;
};

export function mapDatabaseCustomField(
    row: DatabaseCustomFieldDefinition
): ProjectCustomField {
    return {
        appliesTo: [...row.applies_to],
        id: row.id,
        name: row.name,
        position: row.position,
        projectId: row.project_id,
    };
}
