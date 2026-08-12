import { describe, expect, it } from "vitest";

import { resolveEffectiveBoardSprintScope } from "./resolve-effective-board-sprint-scope";

describe("resolveEffectiveBoardSprintScope", () => {
    it("keeps active scope when an active sprint exists", () => {
        expect(
            resolveEffectiveBoardSprintScope({
                boardSprintScope: "active",
                hasActiveSprint: true,
            })
        ).toBe("active");
    });

    it("falls back to entire when active scope has no running sprint", () => {
        expect(
            resolveEffectiveBoardSprintScope({
                boardSprintScope: "active",
                hasActiveSprint: false,
            })
        ).toBe("entire");
    });

    it("keeps entire scope unchanged", () => {
        expect(
            resolveEffectiveBoardSprintScope({
                boardSprintScope: "entire",
                hasActiveSprint: false,
            })
        ).toBe("entire");
    });
});
