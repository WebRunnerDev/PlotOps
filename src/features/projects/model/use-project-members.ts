import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
    confirmProjectInvite,
    createProjectInvite,
    fetchProjectInvites,
    fetchProjectMembers,
    removeProjectMember,
    revokeProjectInvite,
    updateProjectMemberRole,
} from "@/features/projects/api/members-api";
import type {
    InviteTtlValue,
    ProjectMemberRole,
} from "@/features/projects/model/access";
import { projectKeys } from "@/features/projects/model/query-keys";
import { useAuth } from "@/features/auth";
import { supabase } from "@/shared/api/supabase";

function membersKey(projectId: string) {
    return [...projectKeys.detail(projectId), "members"] as const;
}

function invitesKey(projectId: string) {
    return [...projectKeys.detail(projectId), "invites"] as const;
}

export function useProjectMembers(projectId: string) {
    return useQuery({
        enabled: Boolean(projectId),
        queryFn: async () => {
            const { data, error } = await fetchProjectMembers(projectId);
            if (error) throw error;
            return data ?? [];
        },
        queryKey: membersKey(projectId),
    });
}

export function useProjectOwnerProfile(ownerId: string | undefined) {
    return useQuery({
        enabled: Boolean(ownerId),
        queryFn: async () => {
            const { data, error } = await supabase
                .from("profiles")
                .select("id, username, avatar_url")
                .eq("id", ownerId!)
                .single();
            if (error) throw error;
            return data;
        },
        queryKey: ["profiles", ownerId],
    });
}

export function useProjectInvites(projectId: string, enabled = true) {
    return useQuery({
        enabled: Boolean(projectId) && enabled,
        queryFn: async () => {
            const { data, error } = await fetchProjectInvites(projectId);
            if (error) throw error;
            return data ?? [];
        },
        queryKey: invitesKey(projectId),
    });
}

export function useCreateProjectInvite(projectId: string) {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (input: {
            email: string;
            role: ProjectMemberRole;
            ttl: InviteTtlValue;
        }) => {
            if (!user?.id) throw new Error("Not authenticated");
            const { data, error } = await createProjectInvite({
                email: input.email,
                invitedBy: user.id,
                projectId,
                role: input.role,
                ttl: input.ttl,
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: invitesKey(projectId) });
        },
    });
}

export function useRevokeProjectInvite(projectId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (inviteId: string) => {
            const { data, error } = await revokeProjectInvite(inviteId);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: invitesKey(projectId) });
        },
    });
}

export function useConfirmProjectInvite(projectId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: { inviteId: string; userId: string }) => {
            const { data, error } = await confirmProjectInvite(
                input.inviteId,
                input.userId,
            );
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: invitesKey(projectId) });
            queryClient.invalidateQueries({ queryKey: membersKey(projectId) });
        },
    });
}

export function useUpdateMemberRole(projectId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: {
            role: ProjectMemberRole;
            userId: string;
        }) => {
            const { data, error } = await updateProjectMemberRole(
                projectId,
                input.userId,
                input.role,
            );
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: membersKey(projectId) });
        },
    });
}

export function useRemoveProjectMember(projectId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (userId: string) => {
            const { error } = await removeProjectMember(projectId, userId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: membersKey(projectId) });
            queryClient.invalidateQueries({ queryKey: projectKeys.all });
        },
    });
}
