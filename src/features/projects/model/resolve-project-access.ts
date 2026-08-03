import type { TeamAccessState } from "@/features/teams/model/use-team-access";

import {
    capabilitiesForRole,
    type ProjectCapabilities,
} from "@/features/projects/model/access";

const EMPTY: ProjectCapabilities = capabilitiesForRole(null);

export type ProjectAccessState = ProjectCapabilities & {
    isError: boolean;
    isLoading: boolean;
    /** Caps are authoritative only when settled (not loading). */
    isSettled: boolean;
};

export type ResolveProjectAccessInput = {
    project: null | undefined | { team_id: string };
    projectError: boolean;
    projectLoading: boolean;
    teamAccess: TeamAccessState;
};

/**
 * Project screens resolve Team via `team_id`, then defer to Team Role caps.
 * RLS remains the source of truth; this only gates UI.
 */
export function resolveProjectAccess(
    input: ResolveProjectAccessInput
): ProjectAccessState {
    const { project, projectError, projectLoading, teamAccess } = input;

    if (projectError && !project) {
        return {
            ...EMPTY,
            isError: true,
            isLoading: false,
            isSettled: true,
        };
    }

    if (!project) {
        return {
            ...EMPTY,
            isError: false,
            isLoading: projectLoading || teamAccess.isLoading,
            isSettled: false,
        };
    }

    return teamAccess;
}
