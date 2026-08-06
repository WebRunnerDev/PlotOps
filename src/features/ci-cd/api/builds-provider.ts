import type { BuildsForProject } from "@/features/ci-cd/model/types";

import { githubActionsBuilds } from "@/features/ci-cd/api/github-actions-builds";

/**
 * Default CI provider for the Project — GitHub Actions.
 * Prefer `resolveBuildsProvider(isGuest)` at call sites so guest sessions
 * use the canned mock without a GitHub token.
 * Mock lives in `mock-builds.ts` (tests + guest mode).
 */
export const buildsProvider: BuildsForProject = githubActionsBuilds;
