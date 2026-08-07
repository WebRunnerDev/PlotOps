import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
    InviteTtlValue,
    ProjectMemberRole,
} from "@/features/projects/model/access";

import { useAuth } from "@/features/auth";
import { getGuestDisplayIdentity, isGuest } from "@/features/guest-mode";
import { projectKeys } from "@/features/projects/model/query-keys";
import { resolveTeamsProvider } from "@/features/teams/api/resolve-teams-provider";
import {
    confirmTeamInvite,
    createTeamInvite,
    fetchTeamInvites,
    fetchTeamMembers,
    removeTeamMember,
    revokeTeamInvite,
    type TeamInviteKind,
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
            email?: string;
            kind?: TeamInviteKind;
            role: ProjectMemberRole;
            ttl: InviteTtlValue;
        }) => {
            if (!user?.id) throw new Error("Not authenticated");
            const kind = input.kind ?? "email";
            if (kind === "email" && !input.email?.trim()) {
                throw new Error("Email is required");
            }
            const { data, error } = await createTeamInvite({
                email: input.email,
                invitedBy: user.id,
                kind,
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
    const provider = resolveTeamsProvider(isGuest());

    return useQuery({
        enabled: Boolean(teamId),
        queryFn: async () => {
            const { data, error } = await provider.fetchTeam(teamId);
            if (error) throw error;
            return data;
        },
        queryKey: teamKeys.detail(teamId),
    });
}

export function useTeamInvites(teamId: string, enabled = true) {
    const guest = isGuest();

    return useQuery({
        enabled: Boolean(teamId) && enabled && !guest,
        queryFn: async () => {
            const { data, error } = await fetchTeamInvites(teamId);
            if (error) throw error;
            return data ?? [];
        },
        queryKey: teamKeys.invites(teamId),
    });
}

export function useTeamMembers(teamId: string) {
    const guest = isGuest();

    return useQuery({
        enabled: Boolean(teamId),
        queryFn: async () => {
            if (guest) {
                return [];
            }
            const { data, error } = await fetchTeamMembers(teamId);
            if (error) throw error;
            return data ?? [];
        },
        queryKey: teamKeys.members(teamId),
    });
}

export function useTeamOwnerProfile(ownerId: string | undefined) {
    const guest = isGuest();

    return useQuery({
        enabled: Boolean(ownerId),
        queryFn: async () => {
            if (guest) {
                const identity = getGuestDisplayIdentity();
                if (!identity || !ownerId) {
                    throw new Error("No Guest Session");
                }
                return {
                    avatar_url: null as null | string,
                    first_name: identity.firstName,
                    id: ownerId,
                    last_name: identity.lastName,
                    username: identity.username,
                };
            }

            const { data, error } = await supabase
                .from("profiles")
                .select("id, username, avatar_url, first_name, last_name")
                .eq("id", ownerId!)
                .single();
            if (error) throw error;
            return data;
        },
        queryKey: ["profiles", ownerId, guest ? "guest" : "auth"],
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
