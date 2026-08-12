import type {
    ConnectProjectGithubPatch,
    CreateProjectInput,
    Project,
} from "@/features/projects/model/types";

/**
 * Narrow Projects data seam for Guest vs Supabase resolution.
 * Happy-path reads for board navigation; Guest create/delete/connect stay blocked.
 */
export type ProjectsProvider = {
    connectProjectGithub(
        projectId: string,
        patch: ConnectProjectGithubPatch
    ): Promise<{
        data: null | Project;
        error: Error | null;
    }>;
    createProject(input: CreateProjectInput): Promise<{
        data: null | Project;
        error: Error | null;
    }>;
    deleteProject(projectId: string): Promise<{
        data: null | { id: string };
        error: Error | null;
    }>;
    fetchProject(projectId: string): Promise<{
        data: null | Project;
        error: Error | null;
    }>;
    fetchProjects(): Promise<{
        data: null | Project[];
        error: Error | null;
    }>;
    fetchProjectsByTeam(teamId: string): Promise<{
        data: null | Project[];
        error: Error | null;
    }>;
};
