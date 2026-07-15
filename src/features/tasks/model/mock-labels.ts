import type { LabelColor, ProjectLabel } from "./types";

/** Seed label ids used by MOCK_TASKS; remapped to a project on first board open. */
export const SEED_LABEL_DEFS: Array<{
    color: LabelColor;
    id: string;
    name: string;
}> = [
    { color: "red", id: "seed-bug", name: "bug" },
    { color: "blue", id: "seed-feature", name: "feature" },
    { color: "purple", id: "seed-auth", name: "auth" },
    { color: "cyan", id: "seed-ux", name: "ux" },
    { color: "gray", id: "seed-chore", name: "chore" },
];

export function buildSeedLabels(projectId: string): ProjectLabel[] {
    return SEED_LABEL_DEFS.map((label) => ({
        ...label,
        projectId,
    }));
}
