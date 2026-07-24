import type { BuildsForProject } from "@/features/ci-cd/model/types";

import { mockBuildsForProject } from "@/features/ci-cd/api/mock-builds";

/**
 * Default CI provider for the Project — swap for GitHub Actions later at this seam.
 * Shared by list + log stream hooks so there is one injection point.
 */
export const buildsProvider: BuildsForProject = mockBuildsForProject;
