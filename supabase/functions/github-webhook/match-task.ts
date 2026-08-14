export type BoardColumnRow = {
    id: string;
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
 * Extract PlotOps task key from a head branch like `feature/TASK-12-login`
 * or `fix/BUG-5-crash`.
 */
export function extractTaskKeyFromBranch(branchName: string): null | string {
    const normalized = normalizeBranchName(branchName);
    const match = /\/([A-Za-z]+-\d+)(?:-|$)/.exec(normalized);
    return match?.[1] ?? null;
}

export function isAlreadySynced(
    task: CandidateTask,
    lastColumnId: string
): boolean {
    return task.status === lastColumnId && task.pr_state === "merged";
}

/**
 * Match order: pr_number → branch_name → task_key in head.
 * Skips archived tasks.
 */
export function matchTask(
    tasks: CandidateTask[],
    input: { headRef: string; prNumber: number }
): CandidateTask | null {
    const active = tasks.filter((task) => task.archived_at == undefined);

    const byPr = active.find((task) => task.pr_number === input.prNumber);
    if (byPr) {
        return byPr;
    }

    const head = normalizeBranchName(input.headRef);
    const byBranch = active.find(
        (task) =>
            task.branch_name != undefined &&
            normalizeBranchName(task.branch_name) === head
    );
    if (byBranch) {
        return byBranch;
    }

    const key = extractTaskKeyFromBranch(head);
    if (!key) {
        return null;
    }

    const keyUpper = key.toUpperCase();
    return (
        active.find((task) => task.task_key.toUpperCase() === keyUpper) ?? null
    );
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
