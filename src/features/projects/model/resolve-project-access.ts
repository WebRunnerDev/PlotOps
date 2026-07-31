import {
    capabilitiesForRole,
    type ProjectAccessRole,
    type ProjectCapabilities,
    type ProjectMemberRole,
} from "@/features/projects/model/access";

const EMPTY: ProjectCapabilities = capabilitiesForRole(null);

export type ProjectAccessState = ProjectCapabilities & {
    isError: boolean;
    isLoading: boolean;
    /** Caps are authoritative only when settled (not loading). */
    isSettled: boolean;
};

export type ResolveProjectAccessInput = {
    membership: null | undefined | { role: ProjectMemberRole };
    membershipError: boolean;
    membershipLoading: boolean;
    project: null | undefined | { owner_id: string };
    projectLoading: boolean;
    userId: null | string | undefined;
};

export function resolveProjectAccess(
    input: ResolveProjectAccessInput
): ProjectAccessState {
    const {
        membership,
        membershipError,
        membershipLoading,
        project,
        projectLoading,
        userId,
    } = input;

    if (!userId || !project) {
        return {
            ...EMPTY,
            isError: false,
            isLoading: projectLoading || membershipLoading,
            isSettled: false,
        };
    }

    if (project.owner_id === userId) {
        return {
            ...capabilitiesForRole("owner"),
            isError: false,
            isLoading: projectLoading,
            isSettled: !projectLoading,
        };
    }

    if (membershipLoading || projectLoading) {
        return {
            ...EMPTY,
            isError: false,
            isLoading: true,
            isSettled: false,
        };
    }

    if (membershipError) {
        return {
            ...EMPTY,
            isError: true,
            isLoading: false,
            isSettled: true,
        };
    }

    let role: null | ProjectAccessRole = null;
    if (membership?.role) {
        role = membership.role;
    }

    return {
        ...capabilitiesForRole(role),
        isError: false,
        isLoading: false,
        isSettled: true,
    };
}
