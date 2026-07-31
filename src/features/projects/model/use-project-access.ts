import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth";
import { fetchMyProjectMembership } from "@/features/projects/api/members-api";
import { projectKeys } from "@/features/projects/model/query-keys";
import {
    type ProjectAccessState,
    resolveProjectAccess,
} from "@/features/projects/model/resolve-project-access";
import { useProject } from "@/features/projects/model/use-projects";

export function useProjectAccess(projectId: string): ProjectAccessState {
    const { user } = useAuth();
    const {
        data: project,
        isError: projectError,
        isLoading: projectLoading,
    } = useProject(projectId);

    const membershipQuery = useQuery({
        enabled: Boolean(
            projectId && user?.id && project && project.owner_id !== user.id
        ),
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await fetchMyProjectMembership(
                projectId,
                user.id
            );
            if (error) throw error;
            return data;
        },
        queryKey: projectKeys.myMembership(projectId, user?.id),
    });

    const access = resolveProjectAccess({
        membership: membershipQuery.data,
        membershipError: membershipQuery.isError,
        membershipLoading: membershipQuery.isLoading,
        project,
        projectLoading,
        userId: user?.id,
    });

    if (projectError && !project) {
        return {
            ...access,
            isError: true,
            isLoading: false,
            isSettled: true,
        };
    }

    return access;
}
