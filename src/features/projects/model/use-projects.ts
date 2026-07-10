import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
    createProject,
    deleteProject,
    fetchProjects,
    slugifyRepoName,
} from "@/features/projects/api/projects-api";
import type { GitHubRepo } from "@/features/projects/model/types";

import { projectKeys } from "./query-keys";

export function useProjects() {
    return useQuery({
        queryFn: async () => {
            const { data, error } = await fetchProjects();
            if (error) throw error;
            return data;
        },
        queryKey: projectKeys.list(),
    });
}

export function useCreateProject() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (repo: GitHubRepo) => {
            const { data, error } = await createProject({
                description: repo.description,
                github_default_branch: repo.default_branch,
                github_full_name: repo.full_name,
                github_html_url: repo.html_url,
                github_repo_id: repo.id,
                is_private: repo.private,
                name: repo.name,
                slug: slugifyRepoName(repo.name),
            });

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: projectKeys.all });
        },
    });
}

export function useDeleteProject() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (projectId: string) => {
            const { error } = await deleteProject(projectId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: projectKeys.all });
        },
    });
}
