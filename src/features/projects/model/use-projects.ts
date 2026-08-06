import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { GitHubRepo } from "@/features/projects/model/types";

import { isGuest } from "@/features/guest-mode";
import { resolveProjectsProvider } from "@/features/projects/api/resolve-projects-provider";
import {
    buildGitHubCreateProjectInput,
    buildNameOnlyCreateProjectInput,
} from "@/features/projects/model/build-create-project-input";

import { projectKeys } from "./query-keys";

export type CreateProjectMutationInput =
    | {
          mode: "github";
          repo: GitHubRepo;
          teamId: string;
      }
    | {
          mode: "name-only";
          name: string;
          slug: string;
          teamId: string;
      };

export function useCreateProject() {
    const queryClient = useQueryClient();
    const provider = resolveProjectsProvider(isGuest());

    return useMutation({
        mutationFn: async (input: CreateProjectMutationInput) => {
            const payload =
                input.mode === "github"
                    ? buildGitHubCreateProjectInput(input.repo, input.teamId)
                    : buildNameOnlyCreateProjectInput({
                          name: input.name,
                          slug: input.slug,
                          teamId: input.teamId,
                      });

            const { data, error } = await provider.createProject(payload);

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
