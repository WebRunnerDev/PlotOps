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
    return buildProjectRepositoryInput(repo);
}

/**
 * Create Project from one or more GitHub repos (ADR 0035). With one repo, that
 * repo supplies the default name, slug and description. With several, no repo
 * is primary, so the name is required and the slug comes from it. The Project
 * is private when any selected repo is. The RPC links every Repository in one
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

    const isSingle = input.repos.length === 1;
    const name = input.name?.trim() || (isSingle ? first.name : "");
    if (!name) {
        throw new Error(
            "A name is required for a Project with several repositories"
        );
    }

    return {
        description: isSingle ? first.description : null,
        is_private: input.repos.some((repo) => repo.private),
        name,
        repositories: input.repos.map((repo) =>
            buildProjectRepositoryInput(repo)
        ),
        slug: slugifyRepoName(isSingle ? first.full_name : name),
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
        is_private: repo.private,
    };
}

/**
 * Default Project name for a GitHub create: the repo's name when exactly one
 * is selected. With several there is no primary repo, so the person names it.
 */
export function defaultProjectNameFromRepos(
    repos: readonly GitHubRepo[]
): string {
    return repos.length === 1 ? (repos[0]?.name ?? "") : "";
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
