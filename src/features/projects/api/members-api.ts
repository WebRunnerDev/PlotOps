import type {
    InviteTtlValue,
    ProjectMemberRole,
} from "@/features/projects/model/access";

import {
    expiresAtFromTtl,
    MEMBER_ROLES,
} from "@/features/projects/model/access";
import { supabase } from "@/shared/api/supabase";

export type InvitePreview = {
    claimed_by_me: boolean;
    email_matches: boolean;
    expires_at: null | string;
    id: string;
    is_claimed: boolean;
    kind: "email" | "open";
    role: ProjectMemberRole;
    status: ProjectInviteStatus;
    team_id: string;
    team_name: string;
};

export type ProfileSnippet = {
    avatar_url: null | string;
    first_name: null | string;
    id: string;
    last_name: null | string;
    username: null | string;
};

export type ProjectInviteRow = {
    accepted_by: null | string;
    claimed_by: null | string;
    claimed_profile: null | ProfileSnippet;
    created_at: string;
    email: string;
    expires_at: null | string;
    id: string;
    invited_by: string;
    /** Calling Project id — invites are Team-scoped; kept for settings UI. */
    project_id: string;
    role: ProjectMemberRole;
    status: ProjectInviteStatus;
    token: string;
    updated_at: string;
};

export type ProjectInviteStatus =
    "accepted" | "expired" | "pending" | "revoked";

export type ProjectMemberRow = {
    created_at: string;
    profile: null | ProfileSnippet;
    /** Calling Project id — membership is Team-scoped; kept for settings UI. */
    project_id: string;
    role: ProjectMemberRole;
    updated_at: string;
    user_id: string;
};

function asProfile(
    value: null | ProfileSnippet | ProfileSnippet[] | undefined
): null | ProfileSnippet {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapInvite(
    row: Record<string, unknown>,
    projectId: string
): ProjectInviteRow {
    return {
        accepted_by: (row.accepted_by as null | string) ?? null,
        claimed_by: (row.claimed_by as null | string) ?? null,
        claimed_profile: asProfile(
            row.claimed_profile as null | ProfileSnippet | ProfileSnippet[]
        ),
        created_at: row.created_at as string,
        email: row.email as string,
        expires_at: (row.expires_at as null | string) ?? null,
        id: row.id as string,
        invited_by: row.invited_by as string,
        project_id: projectId,
        role: row.role as ProjectMemberRole,
        status: row.status as ProjectInviteStatus,
        token: row.token as string,
        updated_at: row.updated_at as string,
    };
}

function mapMember(
    row: Record<string, unknown>,
    projectId: string
): ProjectMemberRow {
    return {
        created_at: row.created_at as string,
        profile: asProfile(
            row.profile as null | ProfileSnippet | ProfileSnippet[]
        ),
        project_id: projectId,
        role: row.role as ProjectMemberRole,
        updated_at: row.updated_at as string,
        user_id: row.user_id as string,
    };
}

const MEMBER_SELECT = `
  team_id,
  user_id,
  role,
  created_at,
  updated_at,
  profile:profiles!team_members_user_id_fkey (
    id,
    username,
    avatar_url,
    first_name,
    last_name
  )
`;

const INVITE_SELECT = `
  id,
  team_id,
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
  claimed_profile:profiles!team_invites_claimed_by_fkey (
    id,
    username,
    avatar_url,
    first_name,
    last_name
  )
`;

export async function acceptInviteByToken(token: string) {
    return supabase.rpc("accept_team_invite", { p_token: token });
}

export async function claimInviteByToken(token: string) {
    return supabase.rpc("claim_team_invite", { p_token: token });
}

export async function confirmProjectInvite(inviteId: string, userId: string) {
    return supabase.rpc("confirm_team_invite", {
        p_invite_id: inviteId,
        p_user_id: userId,
    });
}

export async function createProjectInvite(input: {
    email: string;
    invitedBy: string;
    projectId: string;
    role: ProjectMemberRole;
    ttl: InviteTtlValue;
}) {
    const { error: teamError, teamId } = await teamIdForProject(
        input.projectId
    );
    if (teamError || !teamId) {
        return {
            data: null,
            error: teamError ?? { message: "Project team not found" },
        };
    }

    const result = await supabase
        .from("team_invites")
        .insert({
            email: input.email.trim().toLowerCase(),
            expires_at: expiresAtFromTtl(input.ttl),
            invited_by: input.invitedBy,
            role: input.role,
            team_id: teamId,
        })
        .select(INVITE_SELECT)
        .single();

    return {
        ...result,
        data: result.data
            ? mapInvite(result.data as Record<string, unknown>, input.projectId)
            : null,
    };
}

export async function fetchMyProjectMembership(
    projectId: string,
    userId: string
): Promise<{
    data: null | { role: ProjectMemberRole };
    error: null | { message: string };
}> {
    const { error: teamError, teamId } = await teamIdForProject(projectId);
    if (teamError || !teamId) {
        return {
            data: null,
            error: teamError ?? { message: "Project team not found" },
        };
    }

    const result = await supabase
        .from("team_members")
        .select("role")
        .eq("team_id", teamId)
        .eq("user_id", userId)
        .maybeSingle();

    if (result.error) {
        return { data: null, error: result.error };
    }

    if (!result.data) {
        return { data: null, error: null };
    }

    const role = result.data.role;
    if (!isProjectMemberRole(role)) {
        return {
            data: null,
            error: { message: `Unknown team member role: ${String(role)}` },
        };
    }

    return { data: { role }, error: null };
}

export async function fetchProjectInvites(projectId: string) {
    const { error: teamError, teamId } = await teamIdForProject(projectId);
    if (teamError || !teamId) {
        return {
            data: null,
            error: teamError ?? { message: "Project team not found" },
        };
    }

    const result = await supabase
        .from("team_invites")
        .select(INVITE_SELECT)
        .eq("team_id", teamId)
        .order("created_at", { ascending: false });

    return {
        ...result,
        data: result.data?.map((row) =>
            mapInvite(row as Record<string, unknown>, projectId)
        ),
    };
}

export async function fetchProjectMembers(projectId: string) {
    const { error: teamError, teamId } = await teamIdForProject(projectId);
    if (teamError || !teamId) {
        return {
            data: null,
            error: teamError ?? { message: "Project team not found" },
        };
    }

    const result = await supabase
        .from("team_members")
        .select(MEMBER_SELECT)
        .eq("team_id", teamId)
        .order("created_at", { ascending: true });

    return {
        ...result,
        data: result.data?.map((row) =>
            mapMember(row as Record<string, unknown>, projectId)
        ),
    };
}

export async function getInviteByToken(token: string) {
    return supabase.rpc("get_team_invite_by_token", { p_token: token });
}

export function inviteUrl(token: string) {
    if (globalThis.window === undefined) return `/invite/${token}`;
    return `${globalThis.location.origin}/invite/${token}`;
}

export async function removeProjectMember(projectId: string, userId: string) {
    const { error: teamError, teamId } = await teamIdForProject(projectId);
    if (teamError || !teamId) {
        return {
            data: null,
            error: teamError ?? { message: "Project team not found" },
        };
    }

    return supabase
        .from("team_members")
        .delete()
        .eq("team_id", teamId)
        .eq("user_id", userId);
}

export async function revokeProjectInvite(inviteId: string) {
    const result = await supabase
        .from("team_invites")
        .update({ status: "revoked" })
        .eq("id", inviteId)
        .select(INVITE_SELECT)
        .single();

    return {
        ...result,
        data: result.data
            ? mapInvite(result.data as Record<string, unknown>, "")
            : null,
    };
}

export async function updateProjectMemberRole(
    projectId: string,
    userId: string,
    role: ProjectMemberRole
) {
    const { error: teamError, teamId } = await teamIdForProject(projectId);
    if (teamError || !teamId) {
        return {
            data: null,
            error: teamError ?? { message: "Project team not found" },
        };
    }

    const result = await supabase
        .from("team_members")
        .update({ role })
        .eq("team_id", teamId)
        .eq("user_id", userId)
        .select(MEMBER_SELECT)
        .single();

    return {
        ...result,
        data: result.data
            ? mapMember(result.data as Record<string, unknown>, projectId)
            : null,
    };
}

function isProjectMemberRole(value: unknown): value is ProjectMemberRole {
    return (MEMBER_ROLES as readonly string[]).includes(String(value));
}

async function teamIdForProject(projectId: string): Promise<{
    error: null | { message: string };
    teamId: null | string;
}> {
    const { data, error } = await supabase
        .from("projects")
        .select("team_id")
        .eq("id", projectId)
        .maybeSingle();

    if (error) return { error, teamId: null };
    if (!data?.team_id) {
        return { error: { message: "Project team not found" }, teamId: null };
    }
    return { error: null, teamId: data.team_id };
}
