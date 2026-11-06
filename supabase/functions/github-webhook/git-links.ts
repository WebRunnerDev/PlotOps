import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import type { CandidateGitLink, CandidateTask } from "./match-task.ts";

export type GitLinkPrRow = {
    id: string;
    pr_number: null | number;
    pr_state: null | string;
    repository_id: string;
};

/** A `project_repositories` row a delivery resolved to. */
export type RepositoryReference = { id: string; project_id: string };

type DismissalRow = { kind: string; task_id: string; value: string };

type TaskWithGitLinkRow = Omit<
    CandidateTask,
    "dismissed_branches" | "dismissed_prs" | "git_links"
> & {
    task_git_links: CandidateGitLink[] | null;
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

/**
 * Every Task Git link with its PR fields — the set merge sync counts
 * (ADR 0035 «Merge sync waits for all PRs»).
 */
export async function fetchTaskGitLinks(
    supabase: SupabaseClient,
    taskId: string
): Promise<GitLinkPrRow[]> {
    const { data, error } = await supabase
        .from("task_git_links")
        .select("id, repository_id, pr_number, pr_state")
        .eq("task_id", taskId);

    if (error) throw error;
    return (data ?? []) as GitLinkPrRow[];
}

/**
 * Repositories linked to this GitHub repository id (at most one per Team).
 * The id survives renames and transfers, unlike `full_name`.
 */
export async function findRepositories(
    supabase: SupabaseClient,
    githubRepoId: number
): Promise<RepositoryReference[]> {
    const { data, error } = await supabase
        .from("project_repositories")
        .select("id, project_id")
        .eq("github_repo_id", githubRepoId);

    if (error) throw error;
    return (data ?? []) as RepositoryReference[];
}

/**
 * Project Tasks shaped for `matchTasks`, with their Git links to
 * `repository` (oldest first) and the branches / PRs people unlinked from
 * the Task in that Repository.
 */
export async function loadCandidateTasks(
    supabase: SupabaseClient,
    repository: RepositoryReference
): Promise<CandidateTask[]> {
    const { data, error } = await supabase
        .from("tasks")
        .select(
            "id, board_id, status, task_key, archived_at, parent_id, task_git_links (id, branch_name, pr_number, pr_state, created_at)"
        )
        .eq("project_id", repository.project_id)
        .eq("task_git_links.repository_id", repository.id);

    if (error) throw error;

    const { data: dismissals, error: dismissalsError } = await supabase
        .from("task_git_link_dismissals")
        .select("task_id, kind, value")
        .eq("repository_id", repository.id);

    if (dismissalsError) throw dismissalsError;

    const branchesByTask = new Map<string, string[]>();
    const prsByTask = new Map<string, number[]>();
    for (const row of (dismissals ?? []) as DismissalRow[]) {
        if (row.kind === "branch") {
            branchesByTask.set(row.task_id, [
                ...(branchesByTask.get(row.task_id) ?? []),
                row.value,
            ]);
        } else if (row.kind === "pr" && /^\d+$/.test(row.value)) {
            prsByTask.set(row.task_id, [
                ...(prsByTask.get(row.task_id) ?? []),
                Number(row.value),
            ]);
        }
    }

    return ((data ?? []) as TaskWithGitLinkRow[]).map(
        ({ task_git_links: links, ...task }) => ({
            ...task,
            dismissed_branches: branchesByTask.get(task.id) ?? [],
            dismissed_prs: prsByTask.get(task.id) ?? [],
            git_links: (
                (links ?? []) as (CandidateGitLink & { created_at?: string })[]
            )
                .toSorted((a, b) =>
                    (a.created_at ?? "").localeCompare(b.created_at ?? "")
                )
                .map(({ branch_name, id, pr_number, pr_state }) => ({
                    branch_name,
                    id,
                    pr_number,
                    pr_state,
                })),
        })
    );
}

/**
 * Add a branch-only Git link (auto-link from a pushed branch). A race with
 * another delivery for the same branch hits the branch-only unique index
 * and leaves the first writer's link in place.
 */
export async function writeBranchLink(
    supabase: SupabaseClient,
    taskId: string,
    repository: RepositoryReference,
    branchName: string
): Promise<void> {
    const { error } = await supabase.from("task_git_links").insert({
        branch_name: branchName,
        project_id: repository.project_id,
        repository_id: repository.id,
        task_id: taskId,
    });

    if (error && error.code !== UNIQUE_VIOLATION) throw error;
}

/**
 * Write PR fields to the Task's Git link `linkId` in `repository`, or add a
 * new Git link (auto-link) when `linkId` is absent. A new link takes
 * `branchName`; a retried delivery for the same PR updates the row it
 * created (`unique (task_id, repository_id, pr_number)`), never a duplicate.
 */
export async function writeGitLink(
    supabase: SupabaseClient,
    taskId: string,
    repository: RepositoryReference,
    update: {
        pr_number: number;
        pr_state: string;
        pr_url: null | string;
    },
    target: { branchName: string } | { linkId: string }
): Promise<void> {
    if ("linkId" in target) {
        const { error } = await supabase
            .from("task_git_links")
            .update(update)
            .eq("id", target.linkId);

        if (error) throw error;
        return;
    }

    const { error } = await supabase.from("task_git_links").upsert(
        {
            ...update,
            branch_name: target.branchName,
            project_id: repository.project_id,
            repository_id: repository.id,
            task_id: taskId,
        },
        { onConflict: "task_id,repository_id,pr_number" }
    );

    if (error) throw error;
}

const UNIQUE_VIOLATION = "23505";
