export type BoardColumnRow = {
    id: string;
    is_done?: boolean | null;
    position: number;
};

export type CandidateTask = {
    archived_at: null | string;
    board_id: string;
    branch_name: null | string;
    id: string;
    parent_id?: null | string;
    pr_number: null | number;
    pr_state: null | string;
    status: string;
    task_key: string;
};

/**
 * What a PR event may do with the matched Task's Git link to this Repository
 * (ADR 0035 «Auto-link»):
 * - `linked`: the link already holds this PR;
 * - `bind`: the link holds this branch but no PR yet;
 * - `auto_link`: matched only by `task_key` and no link exists → create one;
 * - `link_conflict`: the link holds something else — never overwritten.
 */
export type GitLinkBinding = "auto_link" | "bind" | "link_conflict" | "linked";

/** How `matchTask` found the Task, which decides what the event may write. */
export type MatchedBy = "branch" | "pr" | "task_key";

export type TaskMatch = { by: MatchedBy; task: CandidateTask };

/**
 * Extract PlotOps task key from a head branch like `feature/TASK-12-login`
 * or `fix/BUG-5-crash`.
 */
export function extractTaskKeyFromBranch(branchName: string): null | string {
    const normalized = normalizeBranchName(branchName);
    const match = /\/([A-Za-z]+-\d+)(?:-|$)/.exec(normalized);
    return match?.[1] ?? null;
}

/**
 * Match order inside one Repository: pr_number → branch_name → task_key in
 * head. `tasks` carry the Git link to that Repository only, so equal PR
 * numbers from different Repositories never collide. Skips archived tasks.
 */
export function matchTask(
    tasks: CandidateTask[],
    input: { headRef: string; prNumber: number }
): null | TaskMatch {
    const active = tasks.filter((task) => task.archived_at == undefined);

    const byPr = active.find((task) => task.pr_number === input.prNumber);
    if (byPr) {
        return { by: "pr", task: byPr };
    }

    const head = normalizeBranchName(input.headRef);
    const byBranch = active.find(
        (task) =>
            task.branch_name != undefined &&
            normalizeBranchName(task.branch_name) === head
    );
    if (byBranch) {
        return { by: "branch", task: byBranch };
    }

    const key = extractTaskKeyFromBranch(head);
    if (!key) {
        return null;
    }

    const keyUpper = key.toUpperCase();
    const byKey = active.find(
        (task) => task.task_key.toUpperCase() === keyUpper
    );
    return byKey ? { by: "task_key", task: byKey } : null;
}

/** Trim and strip common remotes/refs prefixes. */
export function normalizeBranchName(raw: string): string {
    return raw
        .trim()
        .replace(/^refs\/heads\//i, "")
        .replace(/^origin\//i, "");
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

export function planGitLinkBinding(match: TaskMatch): GitLinkBinding {
    if (match.by === "pr") {
        return "linked";
    }

    const { task } = match;
    if (match.by === "branch") {
        return task.pr_number == undefined ? "bind" : "link_conflict";
    }

    const hasLink =
        task.branch_name != undefined || task.pr_number != undefined;
    return hasLink ? "link_conflict" : "auto_link";
}
