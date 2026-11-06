import {
    extractTaskKeysFromText,
    normalizeGitReference,
} from "../_shared/task-key.ts";

export type BoardColumnRow = {
    id: string;
    is_done?: boolean | null;
    position: number;
};

export type CandidateTask = {
    archived_at: null | string;
    board_id: string;
    branch_name: null | string;
    /** Branches a person unlinked from this Task in this Repository. */
    dismissed_branches?: string[];
    /** PR numbers a person unlinked from this Task in this Repository. */
    dismissed_prs?: number[];
    id: string;
    parent_id?: null | string;
    pr_number: null | number;
    pr_state: null | string;
    status: string;
    task_key: string;
};

/**
 * What a GitHub event may do with the matched Task's Git link to this
 * Repository (ADR 0035 «Auto-link»):
 * - `linked`: the link already holds this PR (or, for a branch event, this
 *   branch);
 * - `bind`: the link holds this branch but no PR yet;
 * - `auto_link`: matched only by task key and no link exists → create one;
 * - `dismissed`: a person unlinked this PR / branch from the Task before;
 * - `link_conflict`: the link holds something else — never overwritten.
 */
export type GitLinkBinding =
    "auto_link" | "bind" | "dismissed" | "link_conflict" | "linked";

/** What a webhook event carries for matching. `prNumber` absent = branch event. */
export type GitReferenceEvent = {
    body?: null | string;
    headRef: string;
    prNumber?: number;
    title?: null | string;
};

/** How `matchTasks` found the Task, which decides what the event may write. */
export type MatchedBy = "branch" | "pr" | "task_key";

/** `key` is the task key found in the event when `by` is `task_key`. */
export type TaskMatch = { by: MatchedBy; key?: string; task: CandidateTask };

/**
 * Every Task the event refers to inside one Repository, strongest match per
 * Task: pr_number → branch_name → a task key anywhere in the head branch, PR
 * title or PR body (case-insensitive). `tasks` carry the Git link to that
 * Repository only, so equal PR numbers from different Repositories never
 * collide. Skips archived tasks.
 */
export function matchTasks(
    tasks: CandidateTask[],
    event: GitReferenceEvent
): TaskMatch[] {
    const active = tasks.filter((task) => task.archived_at == undefined);
    const matches = new Map<string, TaskMatch>();
    const add = (match: TaskMatch) => {
        if (!matches.has(match.task.id)) matches.set(match.task.id, match);
    };

    if (event.prNumber !== undefined) {
        for (const task of active) {
            if (task.pr_number === event.prNumber) add({ by: "pr", task });
        }
    }

    const head = normalizeGitReference(event.headRef);
    for (const task of active) {
        if (
            task.branch_name != undefined &&
            normalizeGitReference(task.branch_name) === head
        ) {
            add({ by: "branch", task });
        }
    }

    const text = [head, event.title, event.body].filter(Boolean).join("\n");
    for (const key of extractTaskKeysFromText(text)) {
        const keyUpper = key.toUpperCase();
        for (const task of active) {
            if (task.task_key.toUpperCase() === keyUpper) {
                add({ by: "task_key", key, task });
            }
        }
    }

    return [...matches.values()];
}

/** Column id with the highest position (Board “Done” end of workflow). */
export function pickLastColumnId(columns: BoardColumnRow[]): null | string {
    if (columns.length === 0) {
        return null;
    }

    let best = columns[0];
    for (const column of columns) {
        if (column.position > best.position) {
            best = column;
        }
    }

    return best.id;
}

export function planGitLinkBinding(
    match: TaskMatch,
    event: Pick<GitReferenceEvent, "headRef" | "prNumber">
): GitLinkBinding {
    if (match.by === "pr") {
        return "linked";
    }

    const { task } = match;
    const prDismissed =
        event.prNumber !== undefined &&
        (task.dismissed_prs ?? []).includes(event.prNumber);

    if (match.by === "branch") {
        if (event.prNumber === undefined) return "linked";
        if (task.pr_number != undefined) return "link_conflict";
        return prDismissed ? "dismissed" : "bind";
    }

    const hasLink =
        task.branch_name != undefined || task.pr_number != undefined;
    if (hasLink) {
        return "link_conflict";
    }

    const head = normalizeGitReference(event.headRef);
    const branchDismissed = (task.dismissed_branches ?? []).some(
        (branch) => normalizeGitReference(branch) === head
    );
    return prDismissed || branchDismissed ? "dismissed" : "auto_link";
}
