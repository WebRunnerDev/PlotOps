import type {
    ConnectProjectGithubPatch,
    CreateProjectInput,
    GitHubRepo,
    ProjectRepositoryInput,
} from "@/features/projects/model/types";

import { slugifyRepoName } from "@/features/projects/api/projects-api";
import { PROJECT_REPOSITORIES_CAP } from "@/features/projects/model/limits";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function buildConnectProjectGithubPatch(
    repo: GitHubRepo
): ConnectProjectGithubPatch {
    return {
        ...buildProjectRepositoryInput(repo),
        is_private: repo.private,
    };
}

/**
 * Create Project from one or more GitHub repos (ADR 0035). The first selected
 * repo supplies the default name, slug and description; the Project is
 * private when any selected repo is. The RPC links every Repository in one
 * transaction — all of them or no Project at all.
 */
export function buildGitHubCreateProjectInput(input: {
    /** Guest Mode: no Repository cap (ADR 0035). */
    isGuest?: boolean;
    name?: string;
    repos: readonly GitHubRepo[];
    teamId: string;
}): CreateProjectInput {
    const [first] = input.repos;
    if (!first) {
        throw new Error("At least one repository is required");
    }
    if (!input.isGuest && input.repos.length > PROJECT_REPOSITORIES_CAP) {
        throw new Error(
            `At most ${PROJECT_REPOSITORIES_CAP} repositories per Project`
        );
    }

    const name = input.name?.trim() || first.name;

    return {
        description: first.description,
        is_private: input.repos.some((repo) => repo.private),
        name,
        repositories: input.repos.map((repo) =>
            buildProjectRepositoryInput(repo)
        ),
        slug: slugifyRepoName(first.full_name),
        team_id: input.teamId,
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

/** Default Project name for a GitHub create: the first selected repo's name. */
export function defaultProjectNameFromRepos(
    repos: readonly GitHubRepo[]
): string {
    return repos[0]?.name ?? "";
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
