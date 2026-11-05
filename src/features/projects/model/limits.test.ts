import { describe, expect, it } from "vitest";

import {
    canAddProjectToTeam,
    canAddRepositoryToProject,
    PROJECT_REPOSITORIES_CAP,
    TEAM_PROJECTS_CAP,
} from "./limits";

describe("canAddProjectToTeam", () => {
    it("allows a Project below the per-Team cap", () => {
        expect(canAddProjectToTeam(TEAM_PROJECTS_CAP - 1)).toBe(true);
    });

    it("blocks a Project at the per-Team cap", () => {
        expect(canAddProjectToTeam(TEAM_PROJECTS_CAP)).toBe(false);
    });
});

describe("canAddRepositoryToProject", () => {
    it("blocks a Repository at the per-Project cap", () => {
        expect(canAddRepositoryToProject(PROJECT_REPOSITORIES_CAP)).toBe(false);
    });

    it("never caps Guest Mode", () => {
        expect(
            canAddRepositoryToProject(PROJECT_REPOSITORIES_CAP + 3, {
                isGuest: true,
            })
        ).toBe(true);
    });
});
