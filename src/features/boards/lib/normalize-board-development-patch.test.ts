import { describe, expect, it } from "vitest";

import { normalizeBoardDevelopmentPatch } from "./normalize-board-development-patch";

describe("normalizeBoardDevelopmentPatch", () => {
    it("clears Base branch and Allowed head patterns when Development is turned off", () => {
        expect(
            normalizeBoardDevelopmentPatch({
                allowed_head_patterns: ["feature/*"],
                base_branch: "main",
                is_development: false,
            })
        ).toEqual({
            allowed_head_patterns: [],
            base_branch: null,
            is_development: false,
        });
    });

    it("trims Base branch when Development stays on", () => {
        expect(
            normalizeBoardDevelopmentPatch({
                base_branch: "  develop  ",
                is_development: true,
            })
        ).toEqual({
            base_branch: "develop",
            is_development: true,
        });
    });
});
