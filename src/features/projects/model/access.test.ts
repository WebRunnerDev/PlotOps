import { describe, expect, it } from "vitest";

import {
    capabilitiesForRole,
    type ProjectAccessRole,
} from "@/features/projects/model/access";

const BOARD_AFFORDANCES = [
    "canCreateTasks",
    "canDeleteTasks",
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

    it("Contributor can edit Tasks but not create/delete or manage Board columns", () => {
        const caps = capabilitiesForRole("contributor");

        expect(caps.canEditTasks).toBe(true);
        expect(caps.canCreateTasks).toBe(false);
        expect(caps.canDeleteTasks).toBe(false);
        expect(caps.canManageBoard).toBe(false);
    });

    it.each([
        "owner",
        "admin",
        "manager",
    ] as const satisfies ProjectAccessRole[])(
        "%s can manage Board columns and create/delete Tasks",
        (role) => {
            const caps = capabilitiesForRole(role);

            expect(caps.canManageBoard).toBe(true);
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
