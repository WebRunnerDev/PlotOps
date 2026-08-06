import { describe, expect, it } from "vitest";

import {
    canChangeMemberRole,
    canConfirmClaimedInvite,
    canEditExistingMemberRole,
    canInviteWithRole,
    canLeaveTeam,
    canRemoveMember,
    canTransferOwnership,
    type MemberActionActor,
} from "@/features/teams/model/member-actions";

const owner: MemberActionActor = { kind: "owner" };
const admin: MemberActionActor = { kind: "member", role: "admin" };
const manager: MemberActionActor = { kind: "member", role: "manager" };
const contributor: MemberActionActor = {
    kind: "member",
    role: "contributor",
};
const viewer: MemberActionActor = { kind: "member", role: "viewer" };

describe("Team member-action policy", () => {
    describe("canLeaveTeam", () => {
        it("Owner cannot leave", () => {
            expect(canLeaveTeam(owner)).toBe(false);
        });

        it.each([admin, manager, contributor, viewer])(
            "$kind $role can leave",
            (actor) => {
                expect(canLeaveTeam(actor)).toBe(true);
            }
        );
    });

    describe("canRemoveMember", () => {
        it("Owner can remove Admin, Manager, Contributor, Viewer", () => {
            expect(canRemoveMember(owner, "admin")).toBe(true);
            expect(canRemoveMember(owner, "manager")).toBe(true);
            expect(canRemoveMember(owner, "contributor")).toBe(true);
            expect(canRemoveMember(owner, "viewer")).toBe(true);
        });

        it("Admin can remove Manager/Contributor/Viewer but not Admin", () => {
            expect(canRemoveMember(admin, "admin")).toBe(false);
            expect(canRemoveMember(admin, "manager")).toBe(true);
            expect(canRemoveMember(admin, "contributor")).toBe(true);
            expect(canRemoveMember(admin, "viewer")).toBe(true);
        });

        it("Manager/Contributor/Viewer cannot remove anyone", () => {
            expect(canRemoveMember(manager, "viewer")).toBe(false);
            expect(canRemoveMember(contributor, "viewer")).toBe(false);
            expect(canRemoveMember(viewer, "viewer")).toBe(false);
        });
    });

    describe("canEditExistingMemberRole", () => {
        it("Owner can edit any Member Role including Admin", () => {
            expect(canEditExistingMemberRole(owner, "admin")).toBe(true);
            expect(canEditExistingMemberRole(owner, "viewer")).toBe(true);
        });

        it("Admin can edit non-Admin only", () => {
            expect(canEditExistingMemberRole(admin, "manager")).toBe(true);
            expect(canEditExistingMemberRole(admin, "admin")).toBe(false);
        });
    });

    describe("canChangeMemberRole", () => {
        it("Owner can set any Member Role including Admin", () => {
            expect(canChangeMemberRole(owner, "viewer", "admin")).toBe(true);
            expect(canChangeMemberRole(owner, "admin", "manager")).toBe(true);
        });

        it("Admin can change non-Admin roles but cannot grant or touch Admin", () => {
            expect(canChangeMemberRole(admin, "viewer", "manager")).toBe(true);
            expect(canChangeMemberRole(admin, "viewer", "admin")).toBe(false);
            expect(canChangeMemberRole(admin, "admin", "manager")).toBe(false);
        });

        it("non-managers of members cannot change roles", () => {
            expect(canChangeMemberRole(manager, "viewer", "contributor")).toBe(
                false
            );
        });
    });

    describe("canInviteWithRole", () => {
        it("Owner can invite Admin", () => {
            expect(canInviteWithRole(owner, "admin")).toBe(true);
        });

        it("Admin can invite Manager/Contributor/Viewer but not Admin", () => {
            expect(canInviteWithRole(admin, "manager")).toBe(true);
            expect(canInviteWithRole(admin, "admin")).toBe(false);
        });

        it("Manager cannot invite", () => {
            expect(canInviteWithRole(manager, "viewer")).toBe(false);
        });
    });

    describe("canConfirmClaimedInvite", () => {
        it("Owner can confirm any claimed invite including Admin", () => {
            expect(canConfirmClaimedInvite(owner, "admin")).toBe(true);
            expect(canConfirmClaimedInvite(owner, "viewer")).toBe(true);
        });

        it("Admin can confirm non-Admin claimed invites only", () => {
            expect(canConfirmClaimedInvite(admin, "contributor")).toBe(true);
            expect(canConfirmClaimedInvite(admin, "admin")).toBe(false);
        });

        it("Manager cannot confirm", () => {
            expect(canConfirmClaimedInvite(manager, "viewer")).toBe(false);
        });
    });

    describe("canTransferOwnership", () => {
        it("only Owner can transfer", () => {
            expect(canTransferOwnership(owner)).toBe(true);
            expect(canTransferOwnership(admin)).toBe(false);
            expect(canTransferOwnership(manager)).toBe(false);
        });
    });
});
