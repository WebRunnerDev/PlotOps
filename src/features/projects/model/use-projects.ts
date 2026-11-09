import {
    type QueryClient,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import type { GitHubRepo } from "@/features/projects/model/types";

// Leaf key modules (no imports) — the feature indexes would form a cycle.
import { boardKeys } from "@/features/boards/model/query-keys";
import { backfillGitLinks } from "@/features/git-integration/api/backfill-git-links-api";
import { isGuest } from "@/features/guest-mode";
import { resolveProjectsProvider } from "@/features/projects/api/resolve-projects-provider";
import {
    buildConnectProjectGithubPatch,
    buildGitHubCreateProjectInput,
    buildNameOnlyCreateProjectInput,
} from "@/features/projects/model/build-create-project-input";
import { taskKeys } from "@/features/tasks/model/query-keys";

import { projectKeys } from "./query-keys";

export type CreateProjectMutationInput =
    | {
          mode: "github";
          /** Overrides the default name taken from `repos[0]`. */
          name?: string;
          repos: GitHubRepo[];
          teamId: string;
      }
    | {
          mode: "name-only";
          name: string;
          slug: string;
          teamId: string;
      };

/** Link a GitHub repository to a Project (Admin+). */
export function useAddProjectRepository(projectId: string) {
    const queryClient = useQueryClient();
    const provider = resolveProjectsProvider(isGuest());

    return useMutation({
        mutationFn: async (repo: GitHubRepo) => {
            const { data, error } = await provider.addProjectRepository(
                projectId,
                buildConnectProjectGithubPatch(repo)
            );
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            invalidateRepositoryDependents(queryClient, projectId);
            if (isGuest()) return;
            // Pull in branches and PRs that already carry a task key (ADR 0035
            // «Auto-link»). Best effort: the Repository is linked either way.
            void backfillGitLinks(projectId)
                .then((result) => {
                    if (result.linked > 0) {
                        void queryClient.invalidateQueries({
                            queryKey: taskKeys.all,
                        });
                    }
                })
                .catch(() => {});
        },
    });
}

export function useCreateProject() {
    const queryClient = useQueryClient();
    const provider = resolveProjectsProvider(isGuest());

    return useMutation({
        mutationFn: async (input: CreateProjectMutationInput) => {
            const payload =
                input.mode === "github"
                    ? buildGitHubCreateProjectInput({
                          isGuest: isGuest(),
                          name: input.name,
                          repos: input.repos,
                          teamId: input.teamId,
                      })
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
        onSuccess: (_data, projectId) => {
            // Same pattern as useDeleteTeam: drop detail (and nested keys under it)
            // so a still-mounted useProject(deletedId) does not GET a gone row.
            queryClient.removeQueries({
                queryKey: projectKeys.detail(projectId),
            });
            queryClient.invalidateQueries({ queryKey: projectKeys.list() });
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

/** Unlink a Repository (Admin+); its Git links go with it. */
export function useRemoveProjectRepository(projectId: string) {
    const queryClient = useQueryClient();
    const provider = resolveProjectsProvider(isGuest());

    return useMutation({
        mutationFn: async (repositoryId: string) => {
            const { error } =
                await provider.removeProjectRepository(repositoryId);
            if (error) throw error;
        },
        onSuccess: () => {
            invalidateRepositoryDependents(queryClient, projectId);
        },
    });
}

/** Rename a Project (Manager+). The slug does not change. */
export function useRenameProject(projectId: string) {
    const queryClient = useQueryClient();
    const provider = resolveProjectsProvider(isGuest());

    return useMutation({
        mutationFn: async (name: string) => {
            const { data, error } = await provider.renameProject(
                projectId,
                name
            );
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: projectKeys.all });
        },
    });
}

/** Tasks holding a Git link to the Repository; idle while `repositoryId` is null. */
export function useRepositoryGitLinkCount(repositoryId: null | string) {
    const provider = resolveProjectsProvider(isGuest());

    return useQuery({
        enabled: Boolean(repositoryId),
        queryFn: async () => {
            const { data, error } = await provider.countRepositoryGitLinks(
                repositoryId!
            );
            if (error) throw error;
            return data ?? 0;
        },
        queryKey: projectKeys.repositoryGitLinkCount(repositoryId ?? ""),
        // Counted right before a destructive confirm — never serve a stale one.
        staleTime: 0,
    });
}

/**
 * Linking or unlinking a Repository changes the Project, the Base branch
 * rows of every Development Board (trigger), and — on unlink — Task Git links.
 */
function invalidateRepositoryDependents(
    queryClient: QueryClient,
    projectId: string
) {
    void queryClient.invalidateQueries({ queryKey: projectKeys.all });
    void queryClient.invalidateQueries({ queryKey: boardKeys.list(projectId) });
    void queryClient.invalidateQueries({ queryKey: taskKeys.all });
}
