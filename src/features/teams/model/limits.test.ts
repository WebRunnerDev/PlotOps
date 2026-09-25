import { describe, expect, it } from "vitest";

import type { TeamRow } from "@/features/teams/api/team-members-api";

import {
    canCreateTeam,
    canJoinTeam,
    countJoinedTeams,
    countOwnedTeams,
    TEAM_MEMBERSHIPS_CAP,
    TEAMS_OWNED_CAP,
} from "./limits";

function joined(count: number): TeamRow[] {
    return Array.from({ length: count }, (_, index) =>
        team(`join-${index}`, `other-${index}`)
    );
}

function owned(count: number): TeamRow[] {
    return Array.from({ length: count }, (_, index) =>
        team(`own-${index}`, "me")
    );
}

function team(id: string, ownerId: string): TeamRow {
    return {
        created_at: "2026-01-01T00:00:00Z",
        id,
        name: id,
        owner_id: ownerId,
        updated_at: "2026-01-01T00:00:00Z",
    };
}

describe("team limits", () => {
    it("splits a Teams list into owned and joined", () => {
        const teams = [...owned(2), ...joined(3)];

        expect(countOwnedTeams(teams, "me")).toBe(2);
        expect(countJoinedTeams(teams, "me")).toBe(3);
    });

    it("allows creating a Team below the owned cap", () => {
        expect(canCreateTeam(owned(TEAMS_OWNED_CAP - 1), "me")).toBe(true);
    });

    it("blocks creating a Team at the owned cap", () => {
        expect(canCreateTeam(owned(TEAMS_OWNED_CAP), "me")).toBe(false);
    });

    it("counts joined Teams separately from owned ones", () => {
        const teams = [...owned(TEAMS_OWNED_CAP), ...joined(1)];

        expect(canJoinTeam(teams, "me")).toBe(true);
    });

    it("blocks joining at the membership cap", () => {
        expect(canJoinTeam(joined(TEAM_MEMBERSHIPS_CAP), "me")).toBe(false);
    });
});
