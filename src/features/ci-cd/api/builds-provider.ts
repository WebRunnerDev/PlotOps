import type { BuildsForProject } from "@/features/ci-cd/model/types";

import { githubActionsBuilds } from "@/features/ci-cd/api/github-actions-builds";

/**
 * Default CI provider for the Project — GitHub Actions.
 * Shared by list + log stream hooks so there is one injection point.
 * Mock lives in `mock-builds.ts` for unit tests only.
 */
export const buildsProvider: BuildsForProject = githubActionsBuilds;
