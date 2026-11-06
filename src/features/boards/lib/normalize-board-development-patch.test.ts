import { describe, expect, it } from "vitest";

import { normalizeBoardDevelopmentPatch } from "./normalize-board-development-patch";

describe("normalizeBoardDevelopmentPatch", () => {
    it("clears Base branches and Allowed head patterns when Development is turned off", () => {
        expect(
            normalizeBoardDevelopmentPatch({
                allowed_head_patterns: ["feature/*"],
                is_development: false,
                repository_base_branches: [
                    { baseBranch: "main", repositoryId: "web" },
                ],
            })
        ).toEqual({
            allowed_head_patterns: [],
            is_development: false,
            repository_base_branches: [],
        });
    });

    it("trims each Repository's Base branch and drops blank ones", () => {
        expect(
            normalizeBoardDevelopmentPatch({
                is_development: true,
                repository_base_branches: [
                    { baseBranch: "  develop  ", repositoryId: "api" },
                    { baseBranch: "   ", repositoryId: "web" },
                ],
            })
        ).toEqual({
            is_development: true,
            repository_base_branches: [
                { baseBranch: "develop", repositoryId: "api" },
            ],
        });
    });

    it("clears the merge target column unless the mode is column", () => {
        expect(
            normalizeBoardDevelopmentPatch({
                merge_target_column_id: "qa",
                merge_target_mode: "none",
            })
        ).toEqual({
            merge_target_column_id: null,
            merge_target_mode: "none",
        });
        expect(
            normalizeBoardDevelopmentPatch({
                merge_target_column_id: "qa",
                merge_target_mode: "column",
            })
        ).toEqual({
            merge_target_column_id: "qa",
            merge_target_mode: "column",
        });
    });
});
