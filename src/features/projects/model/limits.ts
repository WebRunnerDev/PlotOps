/** Max Projects per Team — matches `team_projects_cap()` (ADR 0032). */
export const TEAM_PROJECTS_CAP = 10;

export function canAddProjectToTeam(projectCount: number): boolean {
    return projectCount < TEAM_PROJECTS_CAP;
}

/** Max Repositories per Project — matches `project_repositories_cap()` (ADR 0034). */
export const PROJECT_REPOSITORIES_CAP = 5;

export function canAddRepositoryToProject(repositoryCount: number): boolean {
    return repositoryCount < PROJECT_REPOSITORIES_CAP;
}
