import type { ProjectsProvider } from "@/features/projects/api/projects-provider";

import {
    addProjectRepository,
    countRepositoryGitLinks,
    createProject,
    deleteProject,
    fetchProject,
    fetchProjects,
    fetchProjectsByTeam,
    removeProjectRepository,
    renameProject,
} from "@/features/projects/api/projects-api";

/**
 * Preserve Postgrest `code` (e.g. 23505 unique_violation) and `hint` (cap
 * triggers, P0001) for UI mapping.
 */
function toProviderError(
    error: null | { code?: string; hint?: string; message: string }
): Error | null {
    if (!error) return null;
    const wrapped = new Error(error.message) as Error & {
        code?: string;
        hint?: string;
    };
    if (error.code) wrapped.code = error.code;
    if (error.hint) wrapped.hint = error.hint;
    return wrapped;
}

/** Real-account Projects adapter — delegates to existing Supabase APIs. */
export const supabaseProjectsProvider: ProjectsProvider = {
    async addProjectRepository(projectId, patch) {
        const result = await addProjectRepository(projectId, patch);
        return {
            data: result.data,
            error: toProviderError(result.error),
        };
    },

    async countRepositoryGitLinks(repositoryId) {
        const result = await countRepositoryGitLinks(repositoryId);
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

    async removeProjectRepository(repositoryId) {
        const result = await removeProjectRepository(repositoryId);
        return {
            data: result.data,
            error: toProviderError(result.error),
        };
    },

    async renameProject(projectId, name) {
        const result = await renameProject(projectId, name);
        return {
            data: result.data,
            error: toProviderError(result.error),
        };
    },
};
