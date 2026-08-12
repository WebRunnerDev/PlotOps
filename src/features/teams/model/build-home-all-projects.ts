import type { Project } from "@/features/projects/model/types";

export type HomeAllProjectRow = {
    project: Project;
    teamName: string;
};

/**
 * Builds a read-only flat list of accessible Projects for Home "All projects",
 * enriched with Team display names and sorted for scanability.
 */
export function buildHomeAllProjects(
    projects: readonly Project[],
    teamNameById: ReadonlyMap<string, string>
): HomeAllProjectRow[] {
    return projects
        .map((project) => ({
            project,
            teamName: teamNameById.get(project.team_id) ?? "",
        }))
        .toSorted((a, b) => {
            const byTeam = a.teamName.localeCompare(b.teamName, undefined, {
                sensitivity: "base",
            });
            if (byTeam !== 0) return byTeam;
            return a.project.name.localeCompare(b.project.name, undefined, {
                sensitivity: "base",
            });
        });
}
