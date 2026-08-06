import { useQuery } from "@tanstack/react-query";

import { guestActionPolicy, useAuth } from "@/features/auth";
import { isGuest } from "@/features/guest-mode";
import {
    capabilitiesForRole,
    type ProjectAccessRole,
    type ProjectCapabilities,
    type ProjectMemberRole,
} from "@/features/projects/model/access";
import { resolveTeamsProvider } from "@/features/teams/api/resolve-teams-provider";
import { fetchMyTeamMembership } from "@/features/teams/api/team-members-api";
import { teamKeys } from "@/features/teams/model/query-keys";

const EMPTY: ProjectCapabilities = capabilitiesForRole(null);

export type TeamAccessState = ProjectCapabilities & {
    isError: boolean;
    isLoading: boolean;
    isSettled: boolean;
};

export function resolveTeamAccess(input: {
    membership: null | undefined | { role: ProjectMemberRole };
    membershipError: boolean;
    membershipLoading: boolean;
    team: null | undefined | { owner_id: string };
    teamError: boolean;
    teamLoading: boolean;
    userId: null | string | undefined;
}): TeamAccessState {
    const {
        membership,
        membershipError,
        membershipLoading,
        team,
        teamError,
        teamLoading,
        userId,
    } = input;

    if (teamError && !team) {
        return {
            ...EMPTY,
            isError: true,
            isLoading: false,
            isSettled: true,
        };
    }

    if (!userId || !team) {
        return {
            ...EMPTY,
            isError: false,
            isLoading: teamLoading || membershipLoading,
            isSettled: false,
        };
    }

    if (team.owner_id === userId) {
        return {
            ...capabilitiesForRole("owner"),
            isError: false,
            isLoading: teamLoading,
            isSettled: !teamLoading,
        };
    }

    if (membershipLoading || teamLoading) {
        return {
            ...EMPTY,
            isError: false,
            isLoading: true,
            isSettled: false,
        };
    }

    if (membershipError && !membership) {
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

export function useTeamAccess(teamId: string): TeamAccessState {
    const { user } = useAuth();
    const guest = isGuest();
    const policy = guestActionPolicy(guest);
    const teamsProvider = resolveTeamsProvider(guest);

    const teamQuery = useQuery({
        enabled: Boolean(teamId),
        queryFn: async () => {
            const { data, error } = await teamsProvider.fetchTeam(teamId);
            if (error) throw error;
            return data;
        },
        queryKey: teamKeys.detail(teamId),
    });

    const membershipQuery = useQuery({
        enabled: Boolean(
            !guest &&
            teamId &&
            user?.id &&
            teamQuery.data &&
            teamQuery.data.owner_id !== user.id
        ),
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await fetchMyTeamMembership(
                teamId,
                user.id
            );
            if (error) throw error;
            return data;
        },
        queryKey: teamKeys.myMembership(teamId, user?.id),
    });

    // Guest owns the sandbox Team — grant happy-path caps without Supabase membership.
    if (guest) {
        if (teamQuery.isError && !teamQuery.data) {
            return {
                ...EMPTY,
                isError: true,
                isLoading: false,
                isSettled: true,
            };
        }
        if (!teamQuery.data) {
            return {
                ...EMPTY,
                isError: false,
                isLoading: teamQuery.isLoading,
                isSettled: false,
            };
        }
        const caps = capabilitiesForRole("owner");
        return {
            ...caps,
            canDeleteProject: caps.canDeleteProject && policy.canDeleteProject,
            canDeleteTeam: caps.canDeleteTeam && policy.canDeleteTeam,
            isError: false,
            isLoading: false,
            isSettled: true,
        };
    }

    const access = resolveTeamAccess({
        membership: membershipQuery.data,
        membershipError: membershipQuery.isError,
        membershipLoading: membershipQuery.isLoading,
        team: teamQuery.data,
        teamError: teamQuery.isError,
        teamLoading: teamQuery.isLoading,
        userId: user?.id,
    });

    return {
        ...access,
        canDeleteProject: access.canDeleteProject && policy.canDeleteProject,
        canDeleteTeam: access.canDeleteTeam && policy.canDeleteTeam,
    };
}
