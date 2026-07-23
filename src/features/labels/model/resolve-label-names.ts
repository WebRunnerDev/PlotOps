import type { ProjectLabel } from "./types";

/** Resolve Label names from ids — Tasks store `labelIds` only. */
export function resolveLabelNames(
    labels: ProjectLabel[],
    labelIds: string[] = []
) {
    const byId = new Map(labels.map((label) => [label.id, label.name]));
    const names: string[] = [];
    for (const id of labelIds) {
        const name = byId.get(id);
        if (name) names.push(name);
    }
    return names;
}
