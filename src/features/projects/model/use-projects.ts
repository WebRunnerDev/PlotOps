import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { GitHubRepo } from "@/features/projects/model/types";

import { isGuest } from "@/features/guest-mode";
import { slugifyRepoName } from "@/features/projects/api/projects-api";
import { resolveProjectsProvider } from "@/features/projects/api/resolve-projects-provider";

import { projectKeys } from "./query-keys";

export function useCreateProject() {
    const queryClient = useQueryClient();
    const provider = resolveProjectsProvider(isGuest());

    return useMutation({
        mutationFn: async ({
            repo,
            teamId,
        }: {
            repo: GitHubRepo;
            teamId: string;
        }) => {
            const { data, error } = await provider.createProject({
                description: repo.description,
                github_default_branch: repo.default_branch,
                github_full_name: repo.full_name,
                github_html_url: repo.html_url,
                github_repo_id: repo.id,
                is_private: repo.private,
                name: repo.name,
                slug: slugifyRepoName(repo.full_name),
                team_id: teamId,
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
    const provider = resolveProjectsProvider(isGuest());

    return useMutation({
        mutationFn: async (projectId: string) => {
            const { error } = await provider.deleteProject(projectId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: projectKeys.all });
        },
    });
}

export function useProject(projectId: string) {
    const provider = resolveProjectsProvider(isGuest());

    return useQuery({
        enabled: Boolean(projectId),
        queryFn: async () => {
            const { data, error } = await provider.fetchProject(projectId);
            if (error) throw error;
            return data;
        },
        queryKey: projectKeys.detail(projectId),
    });
}

export function useProjects() {
    const provider = resolveProjectsProvider(isGuest());

    return useQuery({
        queryFn: async () => {
            const { data, error } = await provider.fetchProjects();
            if (error) throw error;
            return data ?? [];
        },
        queryKey: projectKeys.list(),
    });
}

export function useProjectsByTeam(teamId: string) {
    const provider = resolveProjectsProvider(isGuest());

    return useQuery({
        enabled: Boolean(teamId),
        queryFn: async () => {
            const { data, error } = await provider.fetchProjectsByTeam(teamId);
            if (error) throw error;
            return data ?? [];
        },
        queryKey: projectKeys.listByTeam(teamId),
    });
}
