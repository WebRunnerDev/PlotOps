import type { ProjectsProvider } from "@/features/projects/api/projects-provider";

import {
    createProject,
    deleteProject,
    fetchProject,
    fetchProjects,
    fetchProjectsByTeam,
} from "@/features/projects/api/projects-api";

/** Real-account Projects adapter — delegates to existing Supabase APIs. */
export const supabaseProjectsProvider: ProjectsProvider = {
    async createProject(input) {
        const result = await createProject(input);
        return {
            data: result.data,
            error: result.error ? new Error(result.error.message) : null,
        };
    },

    async deleteProject(projectId) {
        const result = await deleteProject(projectId);
        return {
            data: result.data,
            error: result.error ? new Error(result.error.message) : null,
        };
    },

    async fetchProject(projectId) {
        const result = await fetchProject(projectId);
        return {
            data: result.data,
            error: result.error ? new Error(result.error.message) : null,
        };
    },

    async fetchProjects() {
        const result = await fetchProjects();
        return {
            data: result.data ?? null,
            error: result.error ? new Error(result.error.message) : null,
        };
    },

    async fetchProjectsByTeam(teamId) {
        const result = await fetchProjectsByTeam(teamId);
        return {
            data: result.data ?? null,
            error: result.error ? new Error(result.error.message) : null,
        };
    },
};
