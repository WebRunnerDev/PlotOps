import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import type { CandidateTask } from "./match-task.ts";

/** A `project_repositories` row a delivery resolved to. */
export type RepositoryReference = { id: string; project_id: string };

type TaskWithGitLinkRow = Omit<
    CandidateTask,
    "branch_name" | "pr_number" | "pr_state"
> & {
    task_git_links:
        | null
        | {
              branch_name: null | string;
              pr_number: null | number;
              pr_state: null | string;
          }[];
};

/**
 * Base branch of a Board for one Repository (`board_repositories`); null when
 * the Board is not a Development Board.
 */
export async function fetchBoardBaseBranch(
    supabase: SupabaseClient,
    boardId: string,
    repositoryId: string
): Promise<null | string> {
    const { data, error } = await supabase
        .from("board_repositories")
        .select("base_branch")
        .eq("board_id", boardId)
        .eq("repository_id", repositoryId)
        .maybeSingle();

    if (error) throw error;
    return (data?.base_branch as string | undefined) ?? null;
}

/** Repositories linked under this full name (one per Team). */
export async function findRepositories(
    supabase: SupabaseClient,
    repoFullName: string
): Promise<RepositoryReference[]> {
    const { data, error } = await supabase
        .from("project_repositories")
        .select("id, project_id")
        .eq("github_full_name", repoFullName);

    if (error) throw error;
    return (data ?? []) as RepositoryReference[];
}

/**
 * Project Tasks shaped for `matchTask`, with branch / PR taken from the Git
 * link to `repositoryId` (null when the Task has none there).
 */
export async function loadCandidateTasks(
    supabase: SupabaseClient,
    repository: RepositoryReference
): Promise<CandidateTask[]> {
    const { data, error } = await supabase
        .from("tasks")
        .select(
            "id, board_id, status, task_key, archived_at, parent_id, task_git_links (branch_name, pr_number, pr_state)"
        )
        .eq("project_id", repository.project_id)
        .eq("task_git_links.repository_id", repository.id);

    if (error) throw error;

    return ((data ?? []) as TaskWithGitLinkRow[]).map(
        ({ task_git_links: links, ...task }) => {
            const link = links?.[0];
            return {
                ...task,
                branch_name: link?.branch_name ?? null,
                pr_number: link?.pr_number ?? null,
                pr_state: link?.pr_state ?? null,
            };
        }
    );
}

/** Create or update the Task's Git link to `repository` with PR fields. */
export async function writeGitLink(
    supabase: SupabaseClient,
    taskId: string,
    repository: RepositoryReference,
    update: {
        pr_number: number;
        pr_state: string;
        pr_url: null | string;
    }
): Promise<void> {
    const { error } = await supabase.from("task_git_links").upsert(
        {
            ...update,
            project_id: repository.project_id,
            repository_id: repository.id,
            task_id: taskId,
        },
        { onConflict: "task_id,repository_id" }
    );

    if (error) throw error;
}
