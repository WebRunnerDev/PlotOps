import type { ProjectMemberRole } from "@/features/projects/model/access";

export type MemberActionActor =
    { kind: "member"; role: ProjectMemberRole } | { kind: "owner" };

export function actorFromAccess(input: {
    role: "owner" | null | ProjectMemberRole;
}): MemberActionActor | null {
    if (input.role === "owner") return { kind: "owner" };
    if (
        input.role === "admin" ||
        input.role === "manager" ||
        input.role === "contributor" ||
        input.role === "viewer"
    ) {
        return { kind: "member", role: input.role };
    }
    return null;
}

export function canChangeMemberRole(
    actor: MemberActionActor,
    currentRole: ProjectMemberRole,
    nextRole: ProjectMemberRole
): boolean {
    if (actor.kind === "owner") return true;
    if (actor.kind === "member" && actor.role === "admin") {
        return currentRole !== "admin" && nextRole !== "admin";
    }
    return false;
}

export function canConfirmClaimedInvite(
    actor: MemberActionActor,
    inviteRole: ProjectMemberRole
): boolean {
    if (actor.kind === "owner") return true;
    if (actor.kind === "member" && actor.role === "admin") {
        return inviteRole !== "admin";
    }
    return false;
}

export function canEditExistingMemberRole(
    actor: MemberActionActor,
    currentRole: ProjectMemberRole
): boolean {
    if (actor.kind === "owner") return true;
    if (actor.kind === "member" && actor.role === "admin") {
        return currentRole !== "admin";
    }
    return false;
}

export function canInviteWithRole(
    actor: MemberActionActor,
    inviteRole: ProjectMemberRole
): boolean {
    if (actor.kind === "owner") return true;
    if (actor.kind === "member" && actor.role === "admin") {
        return inviteRole !== "admin";
    }
    return false;
}

export function canLeaveTeam(actor: MemberActionActor): boolean {
    return actor.kind === "member";
}

export function canRemoveMember(
    actor: MemberActionActor,
    targetRole: ProjectMemberRole
): boolean {
    if (actor.kind === "owner") return true;
    if (actor.kind === "member" && actor.role === "admin") {
        return targetRole !== "admin";
    }
    return false;
}

export function canTransferOwnership(actor: MemberActionActor): boolean {
    return actor.kind === "owner";
}
