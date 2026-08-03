import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
    InviteTtlValue,
    ProjectMemberRole,
} from "@/features/projects/model/access";

import { useAuth } from "@/features/auth";
import { projectKeys } from "@/features/projects/model/query-keys";
import {
    confirmTeamInvite,
    createTeamInvite,
    fetchTeam,
    fetchTeamInvites,
    fetchTeamMembers,
    removeTeamMember,
    revokeTeamInvite,
    transferTeamOwnership,
    updateTeamMemberRole,
} from "@/features/teams/api/team-members-api";
import { teamKeys } from "@/features/teams/model/query-keys";
import { supabase } from "@/shared/api/supabase";

export function useConfirmTeamInvite(teamId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: { inviteId: string; userId: string }) => {
            const { data, error } = await confirmTeamInvite(
                input.inviteId,
                input.userId
            );
            if (error) throw error;
            return data;
        },
        onSuccess: (_data, input) => {
            queryClient.invalidateQueries({
                queryKey: teamKeys.invites(teamId),
            });
            queryClient.invalidateQueries({
                queryKey: teamKeys.members(teamId),
            });
            queryClient.invalidateQueries({
                queryKey: teamKeys.myMembership(teamId, input.userId),
            });
            queryClient.invalidateQueries({ queryKey: projectKeys.all });
        },
    });
}

export function useCreateTeamInvite(teamId: string) {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (input: {
            email: string;
            role: ProjectMemberRole;
            ttl: InviteTtlValue;
        }) => {
            if (!user?.id) throw new Error("Not authenticated");
            const { data, error } = await createTeamInvite({
                email: input.email,
                invitedBy: user.id,
                role: input.role,
                teamId,
                ttl: input.ttl,
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: teamKeys.invites(teamId),
            });
        },
    });
}

export function useRemoveTeamMember(teamId: string) {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (userId: string) => {
            const { error } = await removeTeamMember(teamId, userId);
            if (error) throw error;
        },
        onSuccess: (_data, removedUserId) => {
            queryClient.invalidateQueries({
                queryKey: teamKeys.members(teamId),
            });
            queryClient.invalidateQueries({ queryKey: projectKeys.all });
            queryClient.invalidateQueries({
                queryKey: teamKeys.myMembership(teamId, removedUserId),
            });
            if (user?.id) {
                queryClient.invalidateQueries({
                    queryKey: teamKeys.myMembership(teamId, user.id),
                });
            }
        },
    });
}

export function useRevokeTeamInvite(teamId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (inviteId: string) => {
            const { data, error } = await revokeTeamInvite(inviteId);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: teamKeys.invites(teamId),
            });
        },
    });
}

export function useTeam(teamId: string) {
    return useQuery({
        enabled: Boolean(teamId),
        queryFn: async () => {
            const { data, error } = await fetchTeam(teamId);
            if (error) throw error;
            return data;
        },
        queryKey: teamKeys.detail(teamId),
    });
}

export function useTeamInvites(teamId: string, enabled = true) {
    return useQuery({
        enabled: Boolean(teamId) && enabled,
        queryFn: async () => {
            const { data, error } = await fetchTeamInvites(teamId);
            if (error) throw error;
            return data ?? [];
        },
        queryKey: teamKeys.invites(teamId),
    });
}

export function useTeamMembers(teamId: string) {
    return useQuery({
        enabled: Boolean(teamId),
        queryFn: async () => {
            const { data, error } = await fetchTeamMembers(teamId);
            if (error) throw error;
            return data ?? [];
        },
        queryKey: teamKeys.members(teamId),
    });
}

export function useTeamOwnerProfile(ownerId: string | undefined) {
    return useQuery({
        enabled: Boolean(ownerId),
        queryFn: async () => {
            const { data, error } = await supabase
                .from("profiles")
                .select("id, username, avatar_url, first_name, last_name")
                .eq("id", ownerId!)
                .single();
            if (error) throw error;
            return data;
        },
        queryKey: ["profiles", ownerId],
    });
}

export function useTransferTeamOwnership(teamId: string) {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (newOwnerId: string) => {
            const { data, error } = await transferTeamOwnership(
                teamId,
                newOwnerId
            );
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: teamKeys.detail(teamId),
            });
            queryClient.invalidateQueries({
                queryKey: teamKeys.members(teamId),
            });
            queryClient.invalidateQueries({ queryKey: projectKeys.all });
            if (user?.id) {
                queryClient.invalidateQueries({
                    queryKey: teamKeys.myMembership(teamId, user.id),
                });
            }
        },
    });
}

export function useUpdateTeamMemberRole(teamId: string) {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (input: {
            role: ProjectMemberRole;
            userId: string;
        }) => {
            const { data, error } = await updateTeamMemberRole(
                teamId,
                input.userId,
                input.role
            );
            if (error) throw error;
            return data;
        },
        onSuccess: (_data, input) => {
            queryClient.invalidateQueries({
                queryKey: teamKeys.members(teamId),
            });
            queryClient.invalidateQueries({
                queryKey: teamKeys.myMembership(teamId, input.userId),
            });
            if (user?.id) {
                queryClient.invalidateQueries({
                    queryKey: teamKeys.myMembership(teamId, user.id),
                });
            }
        },
    });
}
