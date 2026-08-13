import { describe, expect, it } from "vitest";

import {
    capabilitiesForRole,
    type ProjectAccessRole,
} from "@/features/projects/model/access";

const BOARD_AFFORDANCES = [
    "canCreateTasks",
    "canDeleteTasks",
    "canEditEstimate",
    "canEditTasks",
    "canManageBoard",
] as const;

describe("Project Role access seam — Board affordances", () => {
    it("Viewer is read-only on Board/Task mutations", () => {
        const caps = capabilitiesForRole("viewer");

        expect(caps.canView).toBe(true);
        expect(caps.canEditTasks).toBe(false);
        expect(caps.canCreateTasks).toBe(false);
        expect(caps.canDeleteTasks).toBe(false);
        expect(caps.canManageBoard).toBe(false);
    });

    it("Contributor can edit Tasks but not estimates, create/delete, or manage Board", () => {
        const caps = capabilitiesForRole("contributor");

        expect(caps.canEditTasks).toBe(true);
        expect(caps.canEditEstimate).toBe(false);
        expect(caps.canCreateTasks).toBe(false);
        expect(caps.canDeleteTasks).toBe(false);
        expect(caps.canManageBoard).toBe(false);
    });

    it("Contributor Subtask create uses canEditTasks; root create stays Manager+", () => {
        const contributor = capabilitiesForRole("contributor");
        const viewer = capabilitiesForRole("viewer");
        const manager = capabilitiesForRole("manager");

        expect(contributor.canEditTasks).toBe(true);
        expect(contributor.canCreateTasks).toBe(false);
        expect(viewer.canEditTasks).toBe(false);
        expect(viewer.canCreateTasks).toBe(false);
        expect(manager.canEditTasks).toBe(true);
        expect(manager.canCreateTasks).toBe(true);
    });

    it.each([
        "owner",
        "admin",
        "manager",
    ] as const satisfies ProjectAccessRole[])(
        "%s can manage Board columns, estimates, and create/delete Tasks",
        (role) => {
            const caps = capabilitiesForRole(role);

            expect(caps.canManageBoard).toBe(true);
            expect(caps.canEditEstimate).toBe(true);
            expect(caps.canCreateTasks).toBe(true);
            expect(caps.canDeleteTasks).toBe(true);
            expect(caps.canEditTasks).toBe(true);
        }
    );

    it("null role grants no Board/Task write affordances", () => {
        const caps = capabilitiesForRole(null);

        for (const key of BOARD_AFFORDANCES) {
            expect(caps[key]).toBe(false);
        }
        expect(caps.canView).toBe(false);
    });
});

describe("Team Role access seam — Members / Project / Team lifecycle", () => {
    it("Viewer cannot mutate Members, Projects, or Team", () => {
        const caps = capabilitiesForRole("viewer");

        expect(caps.canManageMembers).toBe(false);
        expect(caps.canCreateProject).toBe(false);
        expect(caps.canDeleteProject).toBe(false);
        expect(caps.canDeleteTeam).toBe(false);
        expect(caps.canManageSettings).toBe(false);
    });

    it("Manager cannot manage Members or create Projects", () => {
        const caps = capabilitiesForRole("manager");

        expect(caps.canManageBoard).toBe(true);
        expect(caps.canManageMembers).toBe(false);
        expect(caps.canCreateProject).toBe(false);
        expect(caps.canDeleteProject).toBe(false);
        expect(caps.canDeleteTeam).toBe(false);
        expect(caps.canManageSettings).toBe(false);
    });

    it("Admin can create Projects and manage Members but cannot delete Project/Team", () => {
        const caps = capabilitiesForRole("admin");

        expect(caps.canManageMembers).toBe(true);
        expect(caps.canCreateProject).toBe(true);
        expect(caps.canManageSettings).toBe(true);
        expect(caps.canDeleteProject).toBe(false);
        expect(caps.canDeleteTeam).toBe(false);
    });

    it("Owner can create Projects and delete Project/Team", () => {
        const caps = capabilitiesForRole("owner");

        expect(caps.canManageMembers).toBe(true);
        expect(caps.canCreateProject).toBe(true);
        expect(caps.canDeleteProject).toBe(true);
        expect(caps.canDeleteTeam).toBe(true);
        expect(caps.canGrantAdmin).toBe(true);
    });
});
