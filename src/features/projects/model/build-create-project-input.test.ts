import { describe, expect, it } from "vitest";

import type { GitHubRepo } from "@/features/projects/model/types";

import { PROJECT_REPOSITORIES_CAP } from "@/features/projects/model/limits";

import {
    buildConnectProjectGithubPatch,
    buildGitHubCreateProjectInput,
    buildNameOnlyCreateProjectInput,
    defaultProjectNameFromRepos,
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
    it("links no Repository for a name-only Project", () => {
        expect(
            buildNameOnlyCreateProjectInput({
                name: "  Roadmap  ",
                slug: "roadmap",
                teamId: "team-1",
            })
        ).toEqual({
            description: null,
            is_private: false,
            name: "Roadmap",
            repositories: [],
            slug: "roadmap",
            team_id: "team-1",
        });
    });
});

const apiRepo: GitHubRepo = {
    default_branch: "develop",
    description: "Widgets API",
    full_name: "acme/widgets-api",
    html_url: "https://github.com/acme/widgets-api",
    id: 43,
    name: "widgets-api",
    owner: { avatar_url: "https://example.com/a.png", login: "acme" },
    private: false,
};

describe("buildGitHubCreateProjectInput", () => {
    it("maps repo fields into one Repository and keeps github_repo_id for duplicate-repo uniqueness", () => {
        expect(
            buildGitHubCreateProjectInput({ repos: [repo], teamId: "team-1" })
        ).toEqual({
            description: "Widgets app",
            is_private: true,
            name: "widgets",
            repositories: [
                {
                    github_default_branch: "main",
                    github_full_name: "acme/widgets",
                    github_html_url: "https://github.com/acme/widgets",
                    github_repo_id: 42,
                    is_private: true,
                },
            ],
            slug: "acme-widgets",
            team_id: "team-1",
        });
    });

    it("links every selected Repository in order, each with its own default branch and visibility", () => {
        const input = buildGitHubCreateProjectInput({
            name: "Widgets",
            repos: [apiRepo, repo],
            teamId: "team-1",
        });

        expect(input.repositories).toEqual([
            {
                github_default_branch: "develop",
                github_full_name: "acme/widgets-api",
                github_html_url: "https://github.com/acme/widgets-api",
                github_repo_id: 43,
                is_private: false,
            },
            {
                github_default_branch: "main",
                github_full_name: "acme/widgets",
                github_html_url: "https://github.com/acme/widgets",
                github_repo_id: 42,
                is_private: true,
            },
        ]);
    });

    it("defaults name, slug and description to the repo when only one is selected", () => {
        const input = buildGitHubCreateProjectInput({
            repos: [apiRepo],
            teamId: "team-1",
        });

        expect(input.name).toBe("widgets-api");
        expect(input.slug).toBe("acme-widgets-api");
        expect(input.description).toBe("Widgets API");
    });

    it("with several repos, requires a name and takes no repo as primary", () => {
        expect(() =>
            buildGitHubCreateProjectInput({
                repos: [apiRepo, repo],
                teamId: "team-1",
            })
        ).toThrow();
        expect(() =>
            buildGitHubCreateProjectInput({
                name: "   ",
                repos: [apiRepo, repo],
                teamId: "team-1",
            })
        ).toThrow();

        const input = buildGitHubCreateProjectInput({
            name: "Widgets Platform",
            repos: [apiRepo, repo],
            teamId: "team-1",
        });
        expect(input.name).toBe("Widgets Platform");
        expect(input.slug).toBe("widgets-platform");
        expect(input.description).toBeNull();
    });

    it("uses a custom name when given, and falls back on blank", () => {
        expect(
            buildGitHubCreateProjectInput({
                name: "  Widgets  ",
                repos: [apiRepo, repo],
                teamId: "team-1",
            }).name
        ).toBe("Widgets");
        expect(
            buildGitHubCreateProjectInput({
                name: "   ",
                repos: [apiRepo],
                teamId: "team-1",
            }).name
        ).toBe("widgets-api");
    });

    it("is private when any selected repo is private", () => {
        expect(
            buildGitHubCreateProjectInput({
                repos: [apiRepo],
                teamId: "team-1",
            }).is_private
        ).toBe(false);
        expect(
            buildGitHubCreateProjectInput({
                name: "Widgets",
                repos: [apiRepo, repo],
                teamId: "team-1",
            }).is_private
        ).toBe(true);
    });

    it("rejects an empty selection and more than the Repository cap", () => {
        expect(() =>
            buildGitHubCreateProjectInput({ repos: [], teamId: "team-1" })
        ).toThrow();

        const tooMany = Array.from(
            { length: PROJECT_REPOSITORIES_CAP + 1 },
            (_, index) => ({
                ...repo,
                full_name: `acme/r${index}`,
                id: 100 + index,
                name: `r${index}`,
            })
        );
        expect(() =>
            buildGitHubCreateProjectInput({
                name: "Many",
                repos: tooMany,
                teamId: "team-1",
            })
        ).toThrow();
        expect(
            buildGitHubCreateProjectInput({
                name: "Many",
                repos: tooMany.slice(0, PROJECT_REPOSITORIES_CAP),
                teamId: "team-1",
            }).repositories
        ).toHaveLength(PROJECT_REPOSITORIES_CAP);
    });
});

describe("defaultProjectNameFromRepos", () => {
    it("takes the repo's name when exactly one is selected, else empty", () => {
        expect(defaultProjectNameFromRepos([apiRepo])).toBe("widgets-api");
        expect(defaultProjectNameFromRepos([apiRepo, repo])).toBe("");
        expect(defaultProjectNameFromRepos([])).toBe("");
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
