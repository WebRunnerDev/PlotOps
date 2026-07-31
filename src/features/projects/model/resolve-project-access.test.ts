import { describe, expect, it } from "vitest";

import { resolveProjectAccess } from "@/features/projects/model/resolve-project-access";

describe("resolveProjectAccess", () => {
    it("marks access unsettled while membership is loading for non-owners", () => {
        const access = resolveProjectAccess({
            membership: undefined,
            membershipError: false,
            membershipLoading: true,
            project: { owner_id: "owner-1" },
            projectLoading: false,
            userId: "member-1",
        });

        expect(access.isLoading).toBe(true);
        expect(access.isSettled).toBe(false);
        expect(access.isError).toBe(false);
        expect(access.canEditTasks).toBe(false);
        expect(access.role).toBeNull();
    });

    it("fails closed with isError after membership fetch errors", () => {
        const access = resolveProjectAccess({
            membership: undefined,
            membershipError: true,
            membershipLoading: false,
            project: { owner_id: "owner-1" },
            projectLoading: false,
            userId: "member-1",
        });

        expect(access.isError).toBe(true);
        expect(access.isSettled).toBe(true);
        expect(access.isLoading).toBe(false);
        expect(access.canEditTasks).toBe(false);
        expect(access.canView).toBe(false);
    });

    it("settles owner caps without waiting on membership", () => {
        const access = resolveProjectAccess({
            membership: undefined,
            membershipError: false,
            membershipLoading: true,
            project: { owner_id: "owner-1" },
            projectLoading: false,
            userId: "owner-1",
        });

        expect(access.isSettled).toBe(true);
        expect(access.isLoading).toBe(false);
        expect(access.role).toBe("owner");
        expect(access.canDeleteProject).toBe(true);
        expect(access.canManageBoard).toBe(true);
    });

    it("settles contributor caps from membership data", () => {
        const access = resolveProjectAccess({
            membership: { role: "contributor" },
            membershipError: false,
            membershipLoading: false,
            project: { owner_id: "owner-1" },
            projectLoading: false,
            userId: "member-1",
        });

        expect(access.isSettled).toBe(true);
        expect(access.role).toBe("contributor");
        expect(access.canEditTasks).toBe(true);
        expect(access.canManageBoard).toBe(false);
        expect(access.canCreateTasks).toBe(false);
    });
});
