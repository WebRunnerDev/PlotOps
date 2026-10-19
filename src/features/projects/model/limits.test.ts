import { describe, expect, it } from "vitest";

import { canAddProjectToTeam, TEAM_PROJECTS_CAP } from "./limits";

describe("canAddProjectToTeam", () => {
    it("allows a Project below the per-Team cap", () => {
        expect(canAddProjectToTeam(TEAM_PROJECTS_CAP - 1)).toBe(true);
    });

    it("blocks a Project at the per-Team cap", () => {
        expect(canAddProjectToTeam(TEAM_PROJECTS_CAP)).toBe(false);
    });
});
