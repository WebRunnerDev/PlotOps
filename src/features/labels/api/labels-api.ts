import type {
    LabelColor,
    LabelTaggedTask,
    ProjectLabel,
} from "@/features/labels/model/types";

import { supabase } from "@/shared/api/supabase";

import { type DatabaseLabel, mapDatabaseLabel } from "./label-mappers";

export async function createProjectLabel(
    projectId: string,
    name: string,
    color: LabelColor,
    customColor?: string
) {
    const { data, error } = await supabase
        .from("labels")
        .insert({
            color,
            custom_color: customColor ?? null,
            name,
            project_id: projectId,
        })
        .select("id, project_id, name, color, custom_color")
        .single();

    if (error) throw error;
    return mapDatabaseLabel(data as DatabaseLabel);
}

export async function deleteProjectLabel(labelId: string) {
    const { error } = await supabase.from("labels").delete().eq("id", labelId);
    if (error) throw error;
}

export async function fetchProjectLabels(
    projectId: string
): Promise<ProjectLabel[]> {
    const { data, error } = await supabase
        .from("labels")
        .select("id, project_id, name, color, custom_color")
        .eq("project_id", projectId)
        .order("name", { ascending: true });

    if (error) throw error;
    return ((data ?? []) as DatabaseLabel[]).map((row) =>
        mapDatabaseLabel(row)
    );
}

/**
 * Tasks that reference any Project Label — used by Label settings usage UI.
 * Lives here so settings need not mount the Board workspace aggregate.
 */
export async function fetchProjectLabelTaggedTasks(
    projectId: string
): Promise<LabelTaggedTask[]> {
    const { data, error } = await supabase
        .from("tasks")
        .select(
            `
  id,
  title,
  task_key,
  archived_at,
  task_labels (
    label_id
  )
`
        )
        .eq("project_id", projectId);

    if (error) throw error;

    type Row = {
        archived_at: null | string;
        id: string;
        task_key: string;
        task_labels: Array<{ label_id: string }> | null;
        title: string;
    };

    return ((data ?? []) as Row[]).map((row) => ({
        archivedAt: row.archived_at ?? undefined,
        id: row.id,
        key: row.task_key,
        labelIds: row.task_labels?.map((item) => item.label_id) ?? [],
        title: row.title,
    }));
}

export async function updateProjectLabel(
    labelId: string,
    patch: {
        color?: LabelColor;
        custom_color?: null | string;
        name?: string;
        project_id?: string;
    }
) {
    const { error } = await supabase
        .from("labels")
        .update(patch)
        .eq("id", labelId);
    if (error) throw error;
}
