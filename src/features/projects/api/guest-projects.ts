import type { GuestProject } from "@/features/guest-mode";
import type { ProjectsProvider } from "@/features/projects/api/projects-provider";
import type { Project } from "@/features/projects/model/types";

import { getGuestSandbox } from "@/features/guest-mode";

function mapProject(project: GuestProject, ownerId: string): Project {
    return {
        created_at: project.createdAt,
        description: project.description,
        github_default_branch: project.githubDefaultBranch,
        github_full_name: project.githubFullName,
        github_html_url: project.githubHtmlUrl,
        github_repo_id: project.githubRepoId,
        id: project.id,
        is_private: project.isPrivate,
        name: project.name,
        owner_id: ownerId,
        slug: project.slug,
        team_id: project.teamId,
        updated_at: project.updatedAt,
    };
}

function resolveOwnerId(
    sandbox: NonNullable<ReturnType<typeof getGuestSandbox>>,
    teamId: string
): string {
    return sandbox.teams.find((team) => team.id === teamId)?.ownerId ?? "";
}

/** Guest Mode Projects adapter — reads the local sandbox; never calls Supabase. */
export const guestProjectsProvider: ProjectsProvider = {
    async createProject() {
        return {
            data: null,
            error: new Error(
                "Creating projects is not available in Guest Mode"
            ),
        };
    },

    async deleteProject() {
        return {
            data: null,
            error: new Error(
                "Deleting projects is not available in Guest Mode"
            ),
        };
    },

    async fetchProject(projectId) {
        const sandbox = getGuestSandbox();
        if (!sandbox) {
            return { data: null, error: new Error("No Guest Session") };
        }
        const project = sandbox.projects.find((item) => item.id === projectId);
        if (!project) {
            return { data: null, error: new Error("Project not found") };
        }
        return {
            data: mapProject(project, resolveOwnerId(sandbox, project.teamId)),
            error: null,
        };
    },

    async fetchProjects() {
        const sandbox = getGuestSandbox();
        if (!sandbox) {
            return { data: null, error: new Error("No Guest Session") };
        }
        const projects = [...sandbox.projects]
            .toSorted(
                (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
            )
            .map((project) =>
                mapProject(project, resolveOwnerId(sandbox, project.teamId))
            );
        return { data: projects, error: null };
    },

    async fetchProjectsByTeam(teamId) {
        const sandbox = getGuestSandbox();
        if (!sandbox) {
            return { data: null, error: new Error("No Guest Session") };
        }
        const ownerId = resolveOwnerId(sandbox, teamId);
        const projects = [...sandbox.projects]
            .filter((project) => project.teamId === teamId)
            .toSorted(
                (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
            )
            .map((project) => mapProject(project, ownerId));
        return { data: projects, error: null };
    },
};
