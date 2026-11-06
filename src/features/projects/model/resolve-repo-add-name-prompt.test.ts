import { describe, expect, it } from "vitest";

import { resolveRepoAddNamePrompt } from "./resolve-repo-add-name-prompt";

const widgets = { github_full_name: "acme/widgets" };
const api = { github_full_name: "acme/widgets-api" };

describe("resolveRepoAddNamePrompt", () => {
    it("asks when the single-repo Project still carries its repo's name", () => {
        expect(
            resolveRepoAddNamePrompt({
                name: "widgets",
                repositories: [widgets],
            })
        ).toBe("acme/widgets");
        expect(
            resolveRepoAddNamePrompt({
                name: "  Widgets ",
                repositories: [widgets],
            })
        ).toBe("acme/widgets");
    });

    it("does not ask when the Project was named on its own", () => {
        expect(
            resolveRepoAddNamePrompt({
                name: "Widgets Platform",
                repositories: [widgets],
            })
        ).toBeNull();
    });

    it("does not ask for a name-only or already multi-repo Project", () => {
        expect(
            resolveRepoAddNamePrompt({ name: "widgets", repositories: [] })
        ).toBeNull();
        expect(
            resolveRepoAddNamePrompt({
                name: "widgets",
                repositories: [widgets, api],
            })
        ).toBeNull();
    });
});
