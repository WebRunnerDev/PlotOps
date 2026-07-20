import { useQuery } from "@tanstack/react-query";

import { fetchMyProjectMembership } from "@/features/projects/api/members-api";
import {
    capabilitiesForRole,
    type ProjectAccessRole,
    type ProjectCapabilities,
} from "@/features/projects/model/access";
import { projectKeys } from "@/features/projects/model/query-keys";
import { useProject } from "@/features/projects/model/use-projects";
import { useAuth } from "@/features/auth";

const EMPTY: ProjectCapabilities = capabilitiesForRole(null);

export function useProjectAccess(projectId: string): ProjectCapabilities & {
    isLoading: boolean;
} {
    const { user } = useAuth();
    const { data: project, isLoading: projectLoading } = useProject(projectId);

    const membershipQuery = useQuery({
        enabled: Boolean(projectId && user?.id && project && project.owner_id !== user.id),
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await fetchMyProjectMembership(
                projectId,
                user.id,
            );
            if (error) throw error;
            return data;
        },
        queryKey: [...projectKeys.detail(projectId), "my-membership", user?.id],
    });

    if (!user || !project) {
        return { ...EMPTY, isLoading: projectLoading || membershipQuery.isLoading };
    }

    let role: null | ProjectAccessRole = null;
    if (project.owner_id === user.id) {
        role = "owner";
    } else if (membershipQuery.data?.role) {
        role = membershipQuery.data.role;
    }

    return {
        ...capabilitiesForRole(role),
        isLoading:
            projectLoading ||
            (project.owner_id !== user.id && membershipQuery.isLoading),
    };
}
