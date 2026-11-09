import { describe, expect, it } from "vitest";

import { resolveBoardBaseBranchChips } from "./resolve-board-base-branch-chips";

const web = {
    github_full_name: "acme/web",
    github_html_url: "https://github.com/acme/web",
    id: "r-web",
};
const api = {
    github_full_name: "acme/api",
    github_html_url: "https://github.com/acme/api",
    id: "r-api",
};

describe("resolveBoardBaseBranchChips", () => {
    it("shows no chip on a regular Board", () => {
        expect(
            resolveBoardBaseBranchChips({
                isDevelopment: false,
                repositories: [web],
                repositoryBaseBranches: [
                    { baseBranch: "main", repositoryId: "r-web" },
                ],
            })
        ).toEqual([]);
    });

    it("shows one unlabelled chip when the Project has one Repository", () => {
        expect(
            resolveBoardBaseBranchChips({
                isDevelopment: true,
                repositories: [web],
                repositoryBaseBranches: [
                    { baseBranch: "release/1.0", repositoryId: "r-web" },
                ],
            })
        ).toEqual([
            {
                branch: "release/1.0",
                repoLabel: null,
                repositoryId: "r-web",
                url: "https://github.com/acme/web/tree/release/1.0",
            },
        ]);
    });

    it("shows a labelled chip per Repository in Project order", () => {
        const chips = resolveBoardBaseBranchChips({
            isDevelopment: true,
            repositories: [web, api],
            repositoryBaseBranches: [
                { baseBranch: "develop", repositoryId: "r-api" },
                { baseBranch: "main", repositoryId: "r-web" },
            ],
        });

        expect(
            chips.map((chip) => [chip.repoLabel, chip.branch, chip.url])
        ).toEqual([
            ["web", "main", "https://github.com/acme/web/tree/main"],
            ["api", "develop", "https://github.com/acme/api/tree/develop"],
        ]);
    });

    it("skips a Repository with no Base branch row", () => {
        expect(
            resolveBoardBaseBranchChips({
                isDevelopment: true,
                repositories: [web, api],
                repositoryBaseBranches: [
                    { baseBranch: "main", repositoryId: "r-web" },
                ],
            }).map((chip) => chip.repositoryId)
        ).toEqual(["r-web"]);
    });
});
