/** Max Projects per Team — matches `team_projects_cap()` (ADR 0032). */
export const TEAM_PROJECTS_CAP = 10;

export function canAddProjectToTeam(projectCount: number): boolean {
    return projectCount < TEAM_PROJECTS_CAP;
}

/** Max Repositories per Project — matches `project_repositories_cap()` (ADR 0035). */
export const PROJECT_REPOSITORIES_CAP = 5;

/** Guest Mode is not capped (ADR 0035): the sandbox never hits the trigger. */
export function canAddRepositoryToProject(
    repositoryCount: number,
    options: { isGuest?: boolean } = {}
): boolean {
    return (
        options.isGuest === true || repositoryCount < PROJECT_REPOSITORIES_CAP
    );
}
