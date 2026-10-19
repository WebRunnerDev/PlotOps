/** Max Projects per Team — matches `team_projects_cap()` (ADR 0032). */
export const TEAM_PROJECTS_CAP = 10;

export function canAddProjectToTeam(projectCount: number): boolean {
    return projectCount < TEAM_PROJECTS_CAP;
}
