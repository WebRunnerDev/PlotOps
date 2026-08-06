import { describe, expect, it } from "vitest";

import type { TeamAccessState } from "@/features/teams/model/use-team-access";

import { capabilitiesForRole } from "@/features/projects/model/access";
import { resolveProjectAccess } from "@/features/projects/model/resolve-project-access";

const EMPTY_TEAM: TeamAccessState = {
    ...capabilitiesForRole(null),
    isError: false,
    isLoading: false,
    isSettled: true,
};

const OWNER_TEAM: TeamAccessState = {
    ...capabilitiesForRole("owner"),
    isError: false,
    isLoading: false,
    isSettled: true,
};

const CONTRIBUTOR_TEAM: TeamAccessState = {
    ...capabilitiesForRole("contributor"),
    isError: false,
    isLoading: false,
    isSettled: true,
};

describe("resolveProjectAccess — Project resolves Team via team_id", () => {
    it("marks access unsettled while Project is loading", () => {
        const access = resolveProjectAccess({
            project: undefined,
            projectError: false,
            projectLoading: true,
            teamAccess: EMPTY_TEAM,
        });

        expect(access.isLoading).toBe(true);
        expect(access.isSettled).toBe(false);
        expect(access.canEditTasks).toBe(false);
        expect(access.role).toBeNull();
    });

    it("fails closed when Project fetch errors", () => {
        const access = resolveProjectAccess({
            project: undefined,
            projectError: true,
            projectLoading: false,
            teamAccess: OWNER_TEAM,
        });

        expect(access.isError).toBe(true);
        expect(access.isSettled).toBe(true);
        expect(access.isLoading).toBe(false);
        expect(access.canView).toBe(false);
        expect(access.canDeleteProject).toBe(false);
    });

    it("defers to Team access once Project has team_id", () => {
        const access = resolveProjectAccess({
            project: { team_id: "team-1" },
            projectError: false,
            projectLoading: false,
            teamAccess: CONTRIBUTOR_TEAM,
        });

        expect(access.isSettled).toBe(true);
        expect(access.role).toBe("contributor");
        expect(access.canEditTasks).toBe(true);
        expect(access.canManageBoard).toBe(false);
        expect(access.canCreateTasks).toBe(false);
        expect(access.canCreateProject).toBe(false);
    });

    it("propagates Owner Team caps including delete Project", () => {
        const access = resolveProjectAccess({
            project: { team_id: "team-1" },
            projectError: false,
            projectLoading: false,
            teamAccess: OWNER_TEAM,
        });

        expect(access.role).toBe("owner");
        expect(access.canDeleteProject).toBe(true);
        expect(access.canDeleteTeam).toBe(true);
        expect(access.canCreateProject).toBe(true);
    });

    it("stays unsettled while Team access is still loading", () => {
        const access = resolveProjectAccess({
            project: { team_id: "team-1" },
            projectError: false,
            projectLoading: false,
            teamAccess: {
                ...capabilitiesForRole(null),
                isError: false,
                isLoading: true,
                isSettled: false,
            },
        });

        expect(access.isLoading).toBe(true);
        expect(access.isSettled).toBe(false);
        expect(access.canEditTasks).toBe(false);
    });
});
