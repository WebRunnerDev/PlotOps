import { describe, expect, it } from "vitest";

import type { GitHubRepo } from "@/features/projects/model/types";

import {
    buildConnectProjectGithubPatch,
    buildGitHubCreateProjectInput,
    buildNameOnlyCreateProjectInput,
    isValidProjectName,
    isValidProjectSlug,
    suggestProjectSlug,
} from "./build-create-project-input";

const repo: GitHubRepo = {
    default_branch: "main",
    description: "Widgets app",
    full_name: "acme/widgets",
    html_url: "https://github.com/acme/widgets",
    id: 42,
    name: "widgets",
    owner: { avatar_url: "https://example.com/a.png", login: "acme" },
    private: true,
};

describe("buildNameOnlyCreateProjectInput", () => {
    it("persists null github_* fields for a name-only Project", () => {
        expect(
            buildNameOnlyCreateProjectInput({
                name: "  Roadmap  ",
                slug: "roadmap",
                teamId: "team-1",
            })
        ).toEqual({
            description: null,
            github_default_branch: null,
            github_full_name: null,
            github_html_url: null,
            github_repo_id: null,
            is_private: false,
            name: "Roadmap",
            slug: "roadmap",
            team_id: "team-1",
        });
    });
});

describe("buildGitHubCreateProjectInput", () => {
    it("maps repo fields and keeps github_repo_id for duplicate-repo uniqueness", () => {
        expect(buildGitHubCreateProjectInput(repo, "team-1")).toEqual({
            description: "Widgets app",
            github_default_branch: "main",
            github_full_name: "acme/widgets",
            github_html_url: "https://github.com/acme/widgets",
            github_repo_id: 42,
            is_private: true,
            name: "widgets",
            slug: "acme-widgets",
            team_id: "team-1",
        });
    });
});

describe("buildConnectProjectGithubPatch", () => {
    it("maps github_* + is_private without renaming the Project", () => {
        expect(buildConnectProjectGithubPatch(repo)).toEqual({
            github_default_branch: "main",
            github_full_name: "acme/widgets",
            github_html_url: "https://github.com/acme/widgets",
            github_repo_id: 42,
            is_private: true,
        });
        expect(buildConnectProjectGithubPatch(repo)).not.toHaveProperty("name");
        expect(buildConnectProjectGithubPatch(repo)).not.toHaveProperty("slug");
        expect(buildConnectProjectGithubPatch(repo)).not.toHaveProperty(
            "team_id"
        );
    });
});

describe("name / slug validation", () => {
    it("requires a non-empty trimmed name", () => {
        expect(isValidProjectName("Roadmap")).toBe(true);
        expect(isValidProjectName("  ")).toBe(false);
        expect(isValidProjectName("")).toBe(false);
    });

    it("accepts lowercase alphanumeric slug segments with hyphens", () => {
        expect(isValidProjectSlug("roadmap")).toBe(true);
        expect(isValidProjectSlug("acme-widgets")).toBe(true);
        expect(isValidProjectSlug("")).toBe(false);
        expect(isValidProjectSlug("RoadMap")).toBe(false);
        expect(isValidProjectSlug("-leading")).toBe(false);
        expect(isValidProjectSlug("trailing-")).toBe(false);
        expect(isValidProjectSlug("has space")).toBe(false);
    });

    it("suggests a slug from the project name", () => {
        expect(suggestProjectSlug("Acme Widgets")).toBe("acme-widgets");
        expect(suggestProjectSlug("___")).toBe("repo");
    });
});
