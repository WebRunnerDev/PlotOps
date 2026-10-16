import type { CandidateTask } from "./match-task.ts";

/**
 * PostgREST `max_rows` (supabase/config.toml) silently truncates an unpaged
 * select at 1000. Webhook matching must see every task: a missing `pr_number`
 * row falls through to branch / task-key and can move the wrong task to Done.
 */
export const PROJECT_CANDIDATE_PAGE_SIZE = 1000;

const CANDIDATE_TASK_COLUMNS =
    "id, board_id, status, branch_name, pr_number, pr_state, task_key, archived_at, parent_id";

/** Minimal query surface so tests can page without a live PostgREST client. */
export type ProjectCandidateClient = {
    from: (table: string) => {
        select: (columns: string) => {
            eq: (
                column: string,
                value: string
            ) => {
                order: (
                    column: string,
                    options: { ascending: boolean }
                ) => {
                    range: (
                        from: number,
                        to: number
                    ) => PromiseLike<ProjectCandidatePage>;
                };
            };
        };
    };
};

export type ProjectCandidatePage = {
    data: CandidateTask[] | null;
    error: null | { message: string };
};

/** Every task in a project, ordered by id so pages neither skip nor repeat. */
export async function fetchProjectCandidateTasks(
    supabase: ProjectCandidateClient,
    projectId: string
): Promise<CandidateTask[]> {
    const rows: CandidateTask[] = [];

    for (let offset = 0; ; offset += PROJECT_CANDIDATE_PAGE_SIZE) {
        const { data, error } = await supabase
            .from("tasks")
            .select(CANDIDATE_TASK_COLUMNS)
            .eq("project_id", projectId)
            .order("id", { ascending: true })
            .range(offset, offset + PROJECT_CANDIDATE_PAGE_SIZE - 1);

        if (error) {
            throw error;
        }

        const page = data ?? [];
        rows.push(...page);
        if (page.length < PROJECT_CANDIDATE_PAGE_SIZE) {
            return rows;
        }
    }
}
