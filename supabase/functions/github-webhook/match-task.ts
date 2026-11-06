import {
    extractTaskKeysFromText,
    normalizeGitReference,
} from "../_shared/task-key.ts";

export type BoardColumnRow = {
    id: string;
    is_done?: boolean | null;
    position: number;
};

/** One Git link of a Task in the Repository the event belongs to. */
export type CandidateGitLink = {
    branch_name: null | string;
    id: string;
    pr_number: null | number;
    pr_state: null | string;
};

export type CandidateTask = {
    archived_at: null | string;
    board_id: string;
    /** Branches a person unlinked from this Task in this Repository. */
    dismissed_branches?: string[];
    /** PR numbers a person unlinked from this Task in this Repository. */
    dismissed_prs?: number[];
    /** The Task's Git links to this Repository (ADR 0036: any number). */
    git_links: CandidateGitLink[];
    id: string;
    parent_id?: null | string;
    status: string;
    task_key: string;
};

/**
 * What a GitHub event may do with the matched Task's Git links to this
 * Repository (ADR 0036):
 * - `linked`: a Git link already holds this PR (or, for a branch event, this
 *   branch) — it is updated in place;
 * - `bind`: a Git link holds this branch but no PR yet — the PR joins it;
 * - `auto_link`: no Git link holds this PR / branch → add a new one;
 * - `dismissed`: a person unlinked this PR / branch from the Task before.
 */
export type GitLinkBinding = "auto_link" | "bind" | "dismissed" | "linked";

/** What a webhook event carries for matching. `prNumber` absent = branch event. */
export type GitReferenceEvent = {
    body?: null | string;
    headRef: string;
    prNumber?: number;
    title?: null | string;
};

/** How `matchTasks` found the Task, which decides what the event may write. */
export type MatchedBy = "branch" | "pr" | "task_key";

/**
 * `key` is the task key found in the event when `by` is `task_key`; `link`
 * is the Git link that matched when `by` is `pr` or `branch`.
 */
export type TaskMatch = {
    by: MatchedBy;
    key?: string;
    link?: CandidateGitLink;
    task: CandidateTask;
};

/**
 * Every Task the event refers to inside one Repository, strongest match per
 * Task: pr_number → branch_name → a task key anywhere in the head branch, PR
 * title or PR body (case-insensitive). `tasks` carry their Git links to that
 * Repository only, so equal PR numbers from different Repositories never
 * collide. Skips archived tasks. A branch match prefers a Git link that has
 * no PR yet (the PR can join it).
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
            const link = task.git_links.find(
                (item) => item.pr_number === event.prNumber
            );
            if (link) add({ by: "pr", link, task });
        }
    }

    const head = normalizeGitReference(event.headRef);
    for (const task of active) {
        const sameBranch = task.git_links.filter(
            (item) =>
                item.branch_name != undefined &&
                normalizeGitReference(item.branch_name) === head
        );
        const link =
            sameBranch.find((item) => item.pr_number == undefined) ??
            sameBranch[0];
        if (link) add({ by: "branch", link, task });
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

    const { link, task } = match;
    if (event.prNumber === undefined && match.by === "branch") {
        return "linked";
    }

    const prDismissed =
        event.prNumber !== undefined &&
        (task.dismissed_prs ?? []).includes(event.prNumber);
    if (prDismissed) {
        return "dismissed";
    }

    // The branch is linked without a PR: the PR joins that Git link.
    if (match.by === "branch" && link?.pr_number == undefined) {
        return "bind";
    }

    // The branch is linked with another PR (a second PR from it), or only
    // the key matched: a new Git link, unless the branch was unlinked.
    if (match.by === "task_key") {
        const head = normalizeGitReference(event.headRef);
        const branchDismissed = (task.dismissed_branches ?? []).some(
            (branch) => normalizeGitReference(branch) === head
        );
        if (branchDismissed) return "dismissed";
    }
    return "auto_link";
}
