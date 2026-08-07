import type {
    InviteTtlValue,
    ProjectMemberRole,
} from "@/features/projects/model/access";

import {
    expiresAtFromTtl,
    MEMBER_ROLES,
} from "@/features/projects/model/access";
import { supabase } from "@/shared/api/supabase";

export type ProfileSnippet = {
    avatar_url: null | string;
    first_name: null | string;
    id: string;
    last_name: null | string;
    username: null | string;
};

export type TeamInviteKind = "email" | "open";

export type TeamInviteRow = {
    accepted_by: null | string;
    claimed_by: null | string;
    claimed_profile: null | ProfileSnippet;
    created_at: string;
    email: null | string;
    expires_at: null | string;
    id: string;
    invited_by: string;
    kind: TeamInviteKind;
    redeem_count: number;
    role: ProjectMemberRole;
    status: TeamInviteStatus;
    team_id: string;
    token: string;
    updated_at: string;
};

export type TeamInviteStatus = "accepted" | "expired" | "pending" | "revoked";

export type TeamMemberRow = {
    created_at: string;
    profile: null | ProfileSnippet;
    role: ProjectMemberRole;
    team_id: string;
    updated_at: string;
    user_id: string;
};

export type TeamRow = {
    created_at: string;
    id: string;
    name: string;
    owner_id: string;
    updated_at: string;
};

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
  kind,
  redeem_count,
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

export async function confirmTeamInvite(inviteId: string, userId: string) {
    return supabase.rpc("confirm_team_invite", {
        p_invite_id: inviteId,
        p_user_id: userId,
    });
}

export async function createTeamInvite(input: {
    email?: string;
    invitedBy: string;
    kind?: TeamInviteKind;
    role: ProjectMemberRole;
    teamId: string;
    ttl: InviteTtlValue;
}) {
    const kind = input.kind ?? "email";
    const result = await supabase
        .from("team_invites")
        .insert({
            email:
                kind === "open"
                    ? null
                    : (input.email ?? "").trim().toLowerCase(),
            expires_at: expiresAtFromTtl(input.ttl),
            invited_by: input.invitedBy,
            kind,
            role: input.role,
            team_id: input.teamId,
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

export async function fetchMyTeamMembership(
    teamId: string,
    userId: string
): Promise<{
    data: null | { role: ProjectMemberRole };
    error: null | { message: string };
}> {
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

    if (!isMemberRole(result.data.role)) {
        return {
            data: null,
            error: {
                message: `Unknown team member role: ${String(result.data.role)}`,
            },
        };
    }

    return { data: { role: result.data.role }, error: null };
}

export async function fetchTeam(teamId: string) {
    const result = await supabase
        .from("teams")
        .select("id, name, owner_id, created_at, updated_at")
        .eq("id", teamId)
        .single();

    return {
        ...result,
        data: result.data as null | TeamRow,
    };
}

export async function fetchTeamInvites(teamId: string) {
    const result = await supabase
        .from("team_invites")
        .select(INVITE_SELECT)
        .eq("team_id", teamId)
        .order("created_at", { ascending: false });

    return {
        ...result,
        data: result.data?.map((row) =>
            mapInvite(row as Record<string, unknown>)
        ),
    };
}

export async function fetchTeamMembers(teamId: string) {
    const result = await supabase
        .from("team_members")
        .select(MEMBER_SELECT)
        .eq("team_id", teamId)
        .order("created_at", { ascending: true });

    return {
        ...result,
        data: result.data?.map((row) =>
            mapMember(row as Record<string, unknown>)
        ),
    };
}

export function inviteUrl(token: string) {
    if (globalThis.window === undefined) return `/invite/${token}`;
    return `${globalThis.location.origin}/invite/${token}`;
}

export async function removeTeamMember(teamId: string, userId: string) {
    return supabase
        .from("team_members")
        .delete()
        .eq("team_id", teamId)
        .eq("user_id", userId);
}

export async function revokeTeamInvite(inviteId: string) {
    const result = await supabase
        .from("team_invites")
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

/** Best-effort outbound email for an email-kind pending invite (Edge Function). */
export async function sendTeamInviteEmail(inviteId: string) {
    const origin =
        globalThis.window === undefined
            ? undefined
            : globalThis.location.origin;

    return supabase.functions.invoke("send-team-invite", {
        body: {
            inviteId,
            ...(origin ? { origin } : {}),
        },
        headers: origin ? { "x-invite-origin": origin } : undefined,
    });
}

export async function transferTeamOwnership(
    teamId: string,
    newOwnerId: string
) {
    return supabase.rpc("transfer_team_ownership", {
        p_new_owner_id: newOwnerId,
        p_team_id: teamId,
    });
}

export async function updateTeamMemberRole(
    teamId: string,
    userId: string,
    role: ProjectMemberRole
) {
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
            ? mapMember(result.data as Record<string, unknown>)
            : null,
    };
}

function asProfile(
    value: null | ProfileSnippet | ProfileSnippet[] | undefined
): null | ProfileSnippet {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isMemberRole(value: unknown): value is ProjectMemberRole {
    return (MEMBER_ROLES as readonly string[]).includes(String(value));
}

function mapInvite(row: Record<string, unknown>): TeamInviteRow {
    const kind = row.kind === "open" ? "open" : "email";
    return {
        accepted_by: (row.accepted_by as null | string) ?? null,
        claimed_by: (row.claimed_by as null | string) ?? null,
        claimed_profile: asProfile(
            row.claimed_profile as null | ProfileSnippet | ProfileSnippet[]
        ),
        created_at: row.created_at as string,
        email: (row.email as null | string) ?? null,
        expires_at: (row.expires_at as null | string) ?? null,
        id: row.id as string,
        invited_by: row.invited_by as string,
        kind,
        redeem_count: Number(row.redeem_count ?? 0),
        role: row.role as ProjectMemberRole,
        status: row.status as TeamInviteStatus,
        team_id: row.team_id as string,
        token: row.token as string,
        updated_at: row.updated_at as string,
    };
}

function mapMember(row: Record<string, unknown>): TeamMemberRow {
    return {
        created_at: row.created_at as string,
        profile: asProfile(
            row.profile as null | ProfileSnippet | ProfileSnippet[]
        ),
        role: row.role as ProjectMemberRole,
        team_id: row.team_id as string,
        updated_at: row.updated_at as string,
        user_id: row.user_id as string,
    };
}
