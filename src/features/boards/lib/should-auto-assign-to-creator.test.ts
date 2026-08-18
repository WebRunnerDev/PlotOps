import { describe, expect, it } from "vitest";

import {
    countTeamPeople,
    isSoloTeam,
    shouldAutoAssignToCreator,
} from "./should-auto-assign-to-creator";

describe("countTeamPeople", () => {
    it("counts Owner plus Members", () => {
        expect(countTeamPeople({ hasOwner: true, memberCount: 0 })).toBe(1);
        expect(countTeamPeople({ hasOwner: true, memberCount: 2 })).toBe(3);
        expect(countTeamPeople({ hasOwner: false, memberCount: 1 })).toBe(1);
    });
});

describe("isSoloTeam", () => {
    it("is true only when the Team has one person", () => {
        expect(isSoloTeam(1)).toBe(true);
        expect(isSoloTeam(0)).toBe(false);
        expect(isSoloTeam(2)).toBe(false);
    });
});

describe("shouldAutoAssignToCreator", () => {
    it("assigns when the Board setting is on and the Team is solo", () => {
        expect(
            shouldAutoAssignToCreator({
                autoAssignToCreator: true,
                teamPeopleCount: 1,
            })
        ).toBe(true);
    });

    it("does not assign when the Team has more than one person", () => {
        expect(
            shouldAutoAssignToCreator({
                autoAssignToCreator: true,
                teamPeopleCount: 2,
            })
        ).toBe(false);
    });

    it("does not assign when the Board setting is off", () => {
        expect(
            shouldAutoAssignToCreator({
                autoAssignToCreator: false,
                teamPeopleCount: 1,
            })
        ).toBe(false);
    });
});
