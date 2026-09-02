import type { Project } from "@/features/projects/model/types";

import { isUuid } from "@/shared/lib/is-uuid";

export function resolveProjectByReference(
    projects: readonly Pick<Project, "id" | "slug">[] | undefined,
    reference: string
): Pick<Project, "id" | "slug"> | undefined {
    const normalized = reference.trim();
    if (!normalized) return undefined;

    if (isUuid(normalized)) {
        return projects?.find((project) => project.id === normalized);
    }

    const slug = normalized.toLowerCase();
    return projects?.find((project) => project.slug.toLowerCase() === slug);
}
