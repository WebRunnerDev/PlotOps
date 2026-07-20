import type {
    InviteTtlValue,
    ProjectMemberRole,
} from "@/features/projects/model/access";
import { expiresAtFromTtl } from "@/features/projects/model/access";
import { supabase } from "@/shared/api/supabase";

export type ProfileSnippet = {
    avatar_url: null | string;
    id: string;
    username: null | string;
};

export type ProjectMemberRow = {
    created_at: string;
    project_id: string;
    role: ProjectMemberRole;
    updated_at: string;
    user_id: string;
    profile: null | ProfileSnippet;
};

export type ProjectInviteStatus =
    | "accepted"
    | "expired"
    | "pending"
    | "revoked";

export type ProjectInviteRow = {
    accepted_by: null | string;
    claimed_by: null | string;
    claimed_profile: null | ProfileSnippet;
    created_at: string;
    email: string;
    expires_at: null | string;
    id: string;
    invited_by: string;
    project_id: string;
    role: ProjectMemberRole;
    status: ProjectInviteStatus;
    token: string;
    updated_at: string;
};

export type InvitePreview = {
    email: string;
    expires_at: null | string;
    id: string;
    project_id: string;
    project_name: string;
    role: ProjectMemberRole;
    status: ProjectInviteStatus;
};

function asProfile(
    value: ProfileSnippet | ProfileSnippet[] | null | undefined,
): null | ProfileSnippet {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapMember(row: Record<string, unknown>): ProjectMemberRow {
    return {
        created_at: row.created_at as string,
        profile: asProfile(
            row.profile as ProfileSnippet | ProfileSnippet[] | null,
        ),
        project_id: row.project_id as string,
        role: row.role as ProjectMemberRole,
        updated_at: row.updated_at as string,
        user_id: row.user_id as string,
    };
}

function mapInvite(row: Record<string, unknown>): ProjectInviteRow {
    return {
        accepted_by: (row.accepted_by as string | null) ?? null,
        claimed_by: (row.claimed_by as string | null) ?? null,
        claimed_profile: asProfile(
            row.claimed_profile as ProfileSnippet | ProfileSnippet[] | null,
        ),
        created_at: row.created_at as string,
        email: row.email as string,
        expires_at: (row.expires_at as string | null) ?? null,
        id: row.id as string,
        invited_by: row.invited_by as string,
        project_id: row.project_id as string,
        role: row.role as ProjectMemberRole,
        status: row.status as ProjectInviteStatus,
        token: row.token as string,
        updated_at: row.updated_at as string,
    };
}

const MEMBER_SELECT = `
  project_id,
  user_id,
  role,
  created_at,
  updated_at,
  profile:profiles!project_members_user_id_fkey (
    id,
    username,
    avatar_url
  )
`;

const INVITE_SELECT = `
  id,
  project_id,
  email,
  role,
  token,
  status,
  expires_at,
  invited_by,
  accepted_by,
  claimed_by,
  created_at,
  updated_at,
  claimed_profile:profiles!project_invites_claimed_by_fkey (
    id,
    username,
    avatar_url
  )
`;

export async function fetchProjectMembers(projectId: string) {
    const result = await supabase
        .from("project_members")
        .select(MEMBER_SELECT)
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

    return {
        ...result,
        data: result.data?.map((row) =>
            mapMember(row as Record<string, unknown>),
        ),
    };
}

export async function fetchMyProjectMembership(projectId: string, userId: string) {
    return supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .maybeSingle();
}

export async function fetchProjectInvites(projectId: string) {
    const result = await supabase
        .from("project_invites")
        .select(INVITE_SELECT)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

    return {
        ...result,
        data: result.data?.map((row) =>
            mapInvite(row as Record<string, unknown>),
        ),
    };
}

export async function createProjectInvite(input: {
    email: string;
    projectId: string;
    role: ProjectMemberRole;
    ttl: InviteTtlValue;
    invitedBy: string;
}) {
    const result = await supabase
        .from("project_invites")
        .insert({
            email: input.email.trim().toLowerCase(),
            expires_at: expiresAtFromTtl(input.ttl),
            invited_by: input.invitedBy,
            project_id: input.projectId,
            role: input.role,
        })
        .select(INVITE_SELECT)
        .single();

    return {
        ...result,
        data: result.data
            ? mapInvite(result.data as Record<string, unknown>)
            : null,
    };
}

export async function revokeProjectInvite(inviteId: string) {
    const result = await supabase
        .from("project_invites")
        .update({ status: "revoked" })
        .eq("id", inviteId)
        .select(INVITE_SELECT)
        .single();

    return {
        ...result,
        data: result.data
            ? mapInvite(result.data as Record<string, unknown>)
            : null,
    };
}

export async function updateProjectMemberRole(
    projectId: string,
    userId: string,
    role: ProjectMemberRole,
) {
    const result = await supabase
        .from("project_members")
        .update({ role })
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .select(MEMBER_SELECT)
        .single();

    return {
        ...result,
        data: result.data
            ? mapMember(result.data as Record<string, unknown>)
            : null,
    };
}

export async function removeProjectMember(projectId: string, userId: string) {
    return supabase
        .from("project_members")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", userId);
}

export async function getInviteByToken(token: string) {
    return supabase.rpc("get_project_invite_by_token", { p_token: token });
}

export async function acceptInviteByToken(token: string) {
    return supabase.rpc("accept_project_invite", { p_token: token });
}

export async function claimInviteByToken(token: string) {
    return supabase.rpc("claim_project_invite", { p_token: token });
}

export async function confirmProjectInvite(inviteId: string, userId: string) {
    return supabase.rpc("confirm_project_invite", {
        p_invite_id: inviteId,
        p_user_id: userId,
    });
}

export function inviteUrl(token: string) {
    if (typeof window === "undefined") return `/invite/${token}`;
    return `${window.location.origin}/invite/${token}`;
}
