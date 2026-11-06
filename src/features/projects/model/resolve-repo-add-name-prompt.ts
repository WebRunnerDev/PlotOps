type NamePromptProject = {
    name: string;
    repositories: readonly { github_full_name: string }[];
};

/**
 * Adding a second Repository makes the Project multi-repo, where no Repository
 * is primary (ADR 0035). A Project created from one repo got that repo's name,
 * which then reads as if one repo were the main one. Returns the full name of
 * the repo the Project name was taken from, so the picker can ask for a new
 * name and say why; null when the Project already has its own name, has no
 * Repository yet, or is already multi-repo.
 */
export function resolveRepoAddNamePrompt(
    project: NamePromptProject
): null | string {
    if (project.repositories.length !== 1) return null;
    const [only] = project.repositories;
    if (!only) return null;
    const repoName = only.github_full_name.split("/").pop() ?? "";
    return normalize(project.name) === normalize(repoName)
        ? only.github_full_name
        : null;
}

function normalize(value: string): string {
    return value.trim().toLowerCase();
}
