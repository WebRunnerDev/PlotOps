import type { ProjectsProvider } from "@/features/projects/api/projects-provider";

import {
    connectProjectGithub,
    createProject,
    deleteProject,
    fetchProject,
    fetchProjects,
    fetchProjectsByTeam,
} from "@/features/projects/api/projects-api";

/** Preserve Postgrest `code` (e.g. 23505 unique_violation) for UI mapping. */
function toProviderError(
    error: null | { code?: string; message: string }
): Error | null {
    if (!error) return null;
    const wrapped = new Error(error.message) as Error & { code?: string };
    if (error.code) wrapped.code = error.code;
    return wrapped;
}

/** Real-account Projects adapter — delegates to existing Supabase APIs. */
export const supabaseProjectsProvider: ProjectsProvider = {
    async connectProjectGithub(projectId, patch) {
        const result = await connectProjectGithub(projectId, patch);
        return {
            data: result.data,
            error: toProviderError(result.error),
        };
    },

    async createProject(input) {
        const result = await createProject(input);
        return {
            data: result.data,
            error: toProviderError(result.error),
        };
    },

    async deleteProject(projectId) {
        const result = await deleteProject(projectId);
        return {
            data: result.data,
            error: toProviderError(
                result.error ? { message: result.error.message } : null
            ),
        };
    },

    async fetchProject(projectId) {
        const result = await fetchProject(projectId);
        return {
            data: result.data,
            error: toProviderError(result.error),
        };
    },

    async fetchProjects() {
        const result = await fetchProjects();
        return {
            data: result.data ?? null,
            error: toProviderError(result.error),
        };
    },

    async fetchProjectsByTeam(teamId) {
        const result = await fetchProjectsByTeam(teamId);
        return {
            data: result.data ?? null,
            error: toProviderError(result.error),
        };
    },
};
