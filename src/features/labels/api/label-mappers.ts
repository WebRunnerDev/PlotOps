import type { LabelColor, ProjectLabel } from "@/features/labels/model/types";

export type DatabaseLabel = {
    color: string;
    custom_color: null | string;
    id: string;
    name: string;
    project_id: string;
};

const LABEL_COLORS = new Set<string>([
    "amber",
    "blue",
    "cyan",
    "gray",
    "green",
    "orange",
    "pink",
    "purple",
    "red",
]);

export function mapDatabaseLabel(row: DatabaseLabel): ProjectLabel {
    return {
        color: toLabelColor(row.color),
        customColor: row.custom_color ?? undefined,
        id: row.id,
        name: row.name,
        projectId: row.project_id,
    };
}

function toLabelColor(value: string): LabelColor {
    return LABEL_COLORS.has(value) ? (value as LabelColor) : "gray";
}
