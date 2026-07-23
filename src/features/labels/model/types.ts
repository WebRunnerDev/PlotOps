export type LabelColor =
    | "amber"
    | "blue"
    | "cyan"
    | "gray"
    | "green"
    | "orange"
    | "pink"
    | "purple"
    | "red";

/** Minimal Task ref for Label usage in settings (avoids depending on `features/tasks`). */
export type LabelTaggedTask = {
    archivedAt?: string;
    id: string;
    key: string;
    labelIds: string[];
    title: string;
};

/** Project-scoped label. Future: copy/import labels across projects. */
export type ProjectLabel = {
    color: LabelColor;
    /** Custom hex color (`#rrggbb`). Overrides the `color` preset when set. */
    customColor?: string;
    id: string;
    name: string;
    projectId: string;
};
