import type {
    CustomFieldTaskType,
    CustomFieldValueUsage,
    ProjectCustomField,
    TaskCustomFieldValue,
} from "@/features/custom-fields/model/types";

import { sortCustomFieldsByPosition } from "@/features/custom-fields/model/constants";
import { supabase } from "@/shared/api/supabase";

import {
    type DatabaseCustomFieldDefinition,
    mapDatabaseCustomField,
} from "./custom-field-mappers";

const DEFINITION_COLUMNS =
    "id, project_id, name, position, applies_to" as const;

export async function copyProjectCustomField(
    fieldId: string,
    targetProjectId: string
): Promise<ProjectCustomField> {
    const { data: source, error: sourceError } = await supabase
        .from("custom_field_definitions")
        .select(DEFINITION_COLUMNS)
        .eq("id", fieldId)
        .single();

    if (sourceError) throw sourceError;
    const mapped = mapDatabaseCustomField(
        source as DatabaseCustomFieldDefinition
    );

    return createProjectCustomField(targetProjectId, {
        appliesTo: mapped.appliesTo,
        name: mapped.name,
    });
}

export async function createProjectCustomField(
    projectId: string,
    input: {
        appliesTo: CustomFieldTaskType[];
        name: string;
        position?: number;
    }
): Promise<ProjectCustomField> {
    let position = input.position;
    if (position === undefined) {
        const existing = await fetchProjectCustomFields(projectId);
        position =
            existing.length === 0
                ? 0
                : Math.max(...existing.map((field) => field.position)) + 1;
    }

    const { data, error } = await supabase
        .from("custom_field_definitions")
        .insert({
            applies_to: input.appliesTo,
            name: input.name,
            position,
            project_id: projectId,
        })
        .select(DEFINITION_COLUMNS)
        .single();

    if (error) throw error;
    return mapDatabaseCustomField(data as DatabaseCustomFieldDefinition);
}

export async function deleteProjectCustomField(fieldId: string): Promise<void> {
    const { error } = await supabase
        .from("custom_field_definitions")
        .delete()
        .eq("id", fieldId);
    if (error) throw error;
}

export async function fetchProjectCustomFields(
    projectId: string
): Promise<ProjectCustomField[]> {
    const { data, error } = await supabase
        .from("custom_field_definitions")
        .select(DEFINITION_COLUMNS)
        .eq("project_id", projectId)
        .order("position", { ascending: true })
        .order("name", { ascending: true });

    if (error) throw error;
    return sortCustomFieldsByPosition(
        ((data ?? []) as DatabaseCustomFieldDefinition[]).map((row) =>
            mapDatabaseCustomField(row)
        )
    );
}

/**
 * Tasks that have any custom field value in the Project — Settings usage UI.
 */
export async function fetchProjectCustomFieldValueUsage(
    projectId: string
): Promise<CustomFieldValueUsage[]> {
    const { data: definitions, error: definitionsError } = await supabase
        .from("custom_field_definitions")
        .select("id")
        .eq("project_id", projectId);

    if (definitionsError) throw definitionsError;
    const fieldIds = (definitions ?? []).map((row) => row.id);
    if (fieldIds.length === 0) return [];

    const { data, error } = await supabase
        .from("task_custom_field_values")
        .select(
            `
  field_id,
  task_id,
  tasks!inner (
    id,
    title,
    task_key,
    archived_at,
    project_id
  )
`
        )
        .in("field_id", fieldIds)
        .eq("tasks.project_id", projectId);

    if (error) throw error;

    type Row = {
        field_id: string;
        task_id: string;
        tasks:
            | Array<{
                  archived_at: null | string;
                  id: string;
                  task_key: string;
                  title: string;
              }>
            | null
            | {
                  archived_at: null | string;
                  id: string;
                  task_key: string;
                  title: string;
              };
    };

    return ((data ?? []) as Row[]).flatMap((row) => {
        const task = Array.isArray(row.tasks) ? row.tasks[0] : row.tasks;
        if (!task) return [];
        return [
            {
                archivedAt: task.archived_at ?? undefined,
                fieldId: row.field_id,
                taskId: task.id,
                taskKey: task.task_key,
                title: task.title,
            },
        ];
    });
}

export async function fetchTaskCustomFieldValues(
    taskId: string
): Promise<TaskCustomFieldValue[]> {
    const { data, error } = await supabase
        .from("task_custom_field_values")
        .select("task_id, field_id, value")
        .eq("task_id", taskId);

    if (error) throw error;
    return (
        (data ?? []) as Array<{
            field_id: string;
            task_id: string;
            value: string;
        }>
    ).map((row) => ({
        fieldId: row.field_id,
        taskId: row.task_id,
        value: row.value,
    }));
}

export async function reorderProjectCustomFields(
    projectId: string,
    orderedFieldIds: string[]
): Promise<void> {
    if (orderedFieldIds.length === 0) return;

    const updates = orderedFieldIds.map((fieldId, index) =>
        supabase
            .from("custom_field_definitions")
            .update({ position: index })
            .eq("id", fieldId)
            .eq("project_id", projectId)
    );

    const results = await Promise.all(updates);
    const firstError = results.find((result) => result.error)?.error;
    if (firstError) throw firstError;
}

export async function updateProjectCustomField(
    fieldId: string,
    patch: {
        appliesTo?: CustomFieldTaskType[];
        name?: string;
        position?: number;
    }
): Promise<void> {
    const payload: {
        applies_to?: CustomFieldTaskType[];
        name?: string;
        position?: number;
    } = {};
    if (patch.appliesTo !== undefined) payload.applies_to = patch.appliesTo;
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.position !== undefined) payload.position = patch.position;

    const { error } = await supabase
        .from("custom_field_definitions")
        .update(payload)
        .eq("id", fieldId);
    if (error) throw error;
}

export async function upsertTaskCustomFieldValue(
    taskId: string,
    fieldId: string,
    value: string
): Promise<void> {
    const trimmed = value.trim();
    if (trimmed === "") {
        const { error } = await supabase
            .from("task_custom_field_values")
            .delete()
            .eq("task_id", taskId)
            .eq("field_id", fieldId);
        if (error) throw error;
        return;
    }

    const { error } = await supabase.from("task_custom_field_values").upsert(
        {
            field_id: fieldId,
            task_id: taskId,
            value: trimmed,
        },
        { onConflict: "task_id,field_id" }
    );
    if (error) throw error;
}
