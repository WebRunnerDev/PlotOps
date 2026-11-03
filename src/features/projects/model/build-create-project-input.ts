import type {
    ConnectProjectGithubPatch,
    CreateProjectInput,
    GitHubRepo,
    ProjectRepositoryInput,
} from "@/features/projects/model/types";

import { slugifyRepoName } from "@/features/projects/api/projects-api";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function buildConnectProjectGithubPatch(
    repo: GitHubRepo
): ConnectProjectGithubPatch {
    return {
        ...buildProjectRepositoryInput(repo),
        is_private: repo.private,
    };
}

export function buildGitHubCreateProjectInput(
    repo: GitHubRepo,
    teamId: string
): CreateProjectInput {
    return {
        description: repo.description,
        is_private: repo.private,
        name: repo.name,
        repositories: [buildProjectRepositoryInput(repo)],
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
        is_private: false,
        name: input.name.trim(),
        repositories: [],
        slug: input.slug.trim().toLowerCase(),
        team_id: input.teamId,
    };
}

export function buildProjectRepositoryInput(
    repo: GitHubRepo
): ProjectRepositoryInput {
    return {
        github_default_branch: repo.default_branch,
        github_full_name: repo.full_name,
        github_html_url: repo.html_url,
        github_repo_id: repo.id,
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
