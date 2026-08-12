import type {
    ConnectProjectGithubPatch,
    CreateProjectInput,
    GitHubRepo,
} from "@/features/projects/model/types";

import { slugifyRepoName } from "@/features/projects/api/projects-api";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function buildConnectProjectGithubPatch(
    repo: GitHubRepo
): ConnectProjectGithubPatch {
    return {
        github_default_branch: repo.default_branch,
        github_full_name: repo.full_name,
        github_html_url: repo.html_url,
        github_repo_id: repo.id,
        is_private: repo.private,
    };
}

export function buildGitHubCreateProjectInput(
    repo: GitHubRepo,
    teamId: string
): CreateProjectInput {
    return {
        description: repo.description,
        github_default_branch: repo.default_branch,
        github_full_name: repo.full_name,
        github_html_url: repo.html_url,
        github_repo_id: repo.id,
        is_private: repo.private,
        name: repo.name,
        slug: slugifyRepoName(repo.full_name),
        team_id: teamId,
    };
}

export function buildNameOnlyCreateProjectInput(input: {
    name: string;
    slug: string;
    teamId: string;
}): CreateProjectInput {
    return {
        description: null,
        github_default_branch: null,
        github_full_name: null,
        github_html_url: null,
        github_repo_id: null,
        is_private: false,
        name: input.name.trim(),
        slug: input.slug.trim().toLowerCase(),
        team_id: input.teamId,
    };
}

export function isValidProjectName(name: string): boolean {
    return name.trim().length > 0;
}

export function isValidProjectSlug(slug: string): boolean {
    return SLUG_PATTERN.test(slug.trim());
}

export function suggestProjectSlug(name: string): string {
    return slugifyRepoName(name);
}
