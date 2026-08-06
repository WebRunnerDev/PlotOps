import type { BuildsForProject } from "@/features/ci-cd/model/types";

import { githubActionsBuilds } from "@/features/ci-cd/api/github-actions-builds";
import { mockBuildsForProject } from "@/features/ci-cd/api/mock-builds";

/**
 * Pick the CI provider for the current session.
 * Guest demos have no GitHub token — use the canned mock seam.
 */
export function resolveBuildsProvider(isGuest: boolean): BuildsForProject {
    return isGuest ? mockBuildsForProject : githubActionsBuilds;
}
