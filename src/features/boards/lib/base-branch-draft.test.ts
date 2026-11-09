import { describe, expect, it } from "vitest";

import {
    buildCreateBoardInput,
    hasBlankBaseBranch,
    toBaseBranchDraft,
    toBoardSettingsRepositories,
} from "./base-branch-draft";

const web = { defaultBranch: "main", fullName: "acme/web", id: "repo-web" };
const api = { defaultBranch: "develop", fullName: "acme/api", id: "repo-api" };

describe("create Board Base branches", () => {
    it("gives each Repository its own default branch as the Base branch", () => {
        const draft = toBaseBranchDraft([web, api], []);

        expect(buildCreateBoardInput([web, api], true, draft)).toEqual({
            isDevelopment: true,
            repositoryBaseBranches: [
                { baseBranch: "main", repositoryId: "repo-web" },
                { baseBranch: "develop", repositoryId: "repo-api" },
            ],
        });
    });

    it("keeps an edited Base branch for just that Repository", () => {
        const draft = {
            ...toBaseBranchDraft([web, api], []),
            "repo-api": "  release/2.0 ",
        };

        expect(
            buildCreateBoardInput([web, api], true, draft)
                .repositoryBaseBranches
        ).toEqual([
            { baseBranch: "main", repositoryId: "repo-web" },
            { baseBranch: "release/2.0", repositoryId: "repo-api" },
        ]);
    });

    it("sends one Base branch for a single-Repository Project", () => {
        const draft = toBaseBranchDraft([web], []);

        expect(buildCreateBoardInput([web], true, draft)).toEqual({
            isDevelopment: true,
            repositoryBaseBranches: [
                { baseBranch: "main", repositoryId: "repo-web" },
            ],
        });
    });

    it("sends no Base branches for a regular Board or a Project without Repositories", () => {
        const draft = toBaseBranchDraft([web, api], []);

        expect(buildCreateBoardInput([web, api], false, draft)).toEqual({
            isDevelopment: false,
            repositoryBaseBranches: undefined,
        });
        expect(buildCreateBoardInput([], true, {})).toEqual({
            isDevelopment: false,
            repositoryBaseBranches: undefined,
        });
    });

    it("blocks create while any Repository's Base branch is blank", () => {
        expect(
            hasBlankBaseBranch([web, api], {
                "repo-api": "develop",
                "repo-web": " ",
            })
        ).toBe(true);
        expect(
            hasBlankBaseBranch([web, api], toBaseBranchDraft([web, api], []))
        ).toBe(false);
    });
});

describe("toBoardSettingsRepositories", () => {
    it("maps Project Repository rows", () => {
        expect(
            toBoardSettingsRepositories([
                {
                    github_default_branch: "develop",
                    github_full_name: "acme/api",
                    id: "repo-api",
                },
            ])
        ).toEqual([api]);
    });
});
