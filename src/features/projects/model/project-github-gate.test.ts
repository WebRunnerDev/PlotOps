import { describe, expect, it } from "vitest";

import {
    githubPanelNeedsRepo,
    projectHasGithubRepo,
    resolveProjectConnectHash,
} from "@/features/projects/model/project-github-gate";

describe("projectHasGithubRepo", () => {
    it("is false when github_repo_id is null or undefined", () => {
        expect(projectHasGithubRepo(null)).toBe(false);
        expect(projectHasGithubRepo()).toBe(false);
    });

    it("is true when github_repo_id is a number", () => {
        expect(projectHasGithubRepo(1)).toBe(true);
        expect(projectHasGithubRepo(999_000_001)).toBe(true);
    });
});

describe("githubPanelNeedsRepo", () => {
    it("is true when the Project has no linked repository", () => {
        expect(githubPanelNeedsRepo()).toBe(true);
        expect(githubPanelNeedsRepo("")).toBe(true);
        expect(githubPanelNeedsRepo("   ")).toBe(true);
    });

    it("is false when repo full name is present", () => {
        expect(githubPanelNeedsRepo("acme/widgets")).toBe(false);
    });
});

describe("resolveProjectConnectHash", () => {
    it("returns the settings connect deep-link hash", () => {
        expect(resolveProjectConnectHash()).toBe("connect");
    });
});
