import {
    type ProjectAccessState,
    resolveProjectAccess,
} from "@/features/projects/model/resolve-project-access";
import { useProject } from "@/features/projects/model/use-projects";
import { useTeamAccess } from "@/features/teams/model/use-team-access";

/**
 * Thin wrap: Project UI loads `team_id`, then uses Team Role caps via
 * `useTeamAccess`. Prefer calling `useTeamAccess(teamId)` directly when
 * the Team id is already known.
 */
export function useProjectAccess(projectId: string): ProjectAccessState {
    const {
        data: project,
        isError: projectError,
        isLoading: projectLoading,
    } = useProject(projectId);

    const teamAccess = useTeamAccess(project?.team_id ?? "");

    return resolveProjectAccess({
        project,
        projectError,
        projectLoading,
        teamAccess,
    });
}
