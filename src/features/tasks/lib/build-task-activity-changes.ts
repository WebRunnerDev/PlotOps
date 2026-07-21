import type {
    Task,
    TaskActivityChange,
    TaskActivityField,
    TaskPriority,
    TaskPullRequest,
    TaskType,
} from "@/features/tasks/model/types";

export type TaskActivitySnapshot = {
    assignee: null | { id: string; name: string };
    board?: null | { id: string; name: string };
    branchName: null | string;
    deadline: null | string;
    labelNames: string[];
    pr: null | { number: number; state: string };
    priority: null | TaskPriority;
    status: { id: string; name: string };
    title: string;
    type: TaskType;
};

export function applyDetailsToSnapshot(
    base: TaskActivitySnapshot,
    details: {
        assignee?: null | Task["assignee"];
        branchName?: null | string;
        deadline?: null | string;
        labelNames?: string[];
        pr?: null | TaskPullRequest;
        priority?: null | TaskPriority;
        title?: string;
        type?: TaskType;
    },
): TaskActivitySnapshot {
    return {
        ...base,
        assignee:
            details.assignee === undefined
                ? base.assignee
                : (details.assignee
                  ? { id: details.assignee.id, name: details.assignee.name }
                  : null),
        branchName:
            details.branchName === undefined
                ? base.branchName
                : (details.branchName ?? null),
        deadline:
            details.deadline === undefined
                ? base.deadline
                : (details.deadline ?? null),
        labelNames:
            details.labelNames === undefined
                ? base.labelNames
                : details.labelNames,
        pr:
            details.pr === undefined
                ? base.pr
                : (details.pr
                  ? { number: details.pr.number, state: details.pr.state }
                  : null),
        priority:
            details.priority === undefined
                ? base.priority
                : (details.priority ?? null),
        title: details.title === undefined ? base.title : details.title,
        type: details.type === undefined ? base.type : details.type,
    };
}

/** Diff two snapshots into a batched `changes` list (empty if nothing logged). */
export function buildTaskActivityChanges(
    before: TaskActivitySnapshot,
    after: TaskActivitySnapshot,
): TaskActivityChange[] {
    const changes: TaskActivityChange[] = [];

    if (before.title !== after.title) {
        pushChange(changes, "title", before.title, after.title);
    }
    if (before.type !== after.type) {
        pushChange(changes, "type", before.type, after.type);
    }
    if (before.priority !== after.priority) {
        pushChange(changes, "priority", before.priority, after.priority);
    }
    if (before.deadline !== after.deadline) {
        pushChange(changes, "deadline", before.deadline, after.deadline);
    }
    if (before.status.id !== after.status.id) {
        pushChange(changes, "status", before.status, after.status);
    }
    if (!samePerson(before.assignee, after.assignee)) {
        pushChange(changes, "assignee", before.assignee, after.assignee);
    }
    if (!sameLabels(before.labelNames, after.labelNames)) {
        pushChange(changes, "labels", before.labelNames, after.labelNames);
    }
    if (before.branchName !== after.branchName) {
        pushChange(changes, "branch", before.branchName, after.branchName);
    }
    if (!samePr(before.pr, after.pr)) {
        pushChange(changes, "pr", before.pr, after.pr);
    }
    if (
        before.board &&
        after.board &&
        before.board.id !== after.board.id
    ) {
        pushChange(changes, "board", before.board, after.board);
    }

    return changes;
}

/** Build a display-oriented snapshot used for activity diffs. */
export function toTaskActivitySnapshot(
    task: Task,
    options?: {
        board?: null | { id: string; name: string };
        labelNames?: string[];
        statusName?: string;
    },
): TaskActivitySnapshot {
    return {
        assignee: task.assignee
            ? { id: task.assignee.id, name: task.assignee.name }
            : null,
        board: options?.board,
        branchName: task.branchName ?? null,
        deadline: task.deadline ?? null,
        labelNames: options?.labelNames ?? [],
        pr: task.pr
            ? { number: task.pr.number, state: task.pr.state }
            : null,
        priority: task.priority ?? null,
        status: {
            id: task.status,
            name: options?.statusName ?? task.status,
        },
        title: task.title,
        type: task.type,
    };
}

function pushChange(
    changes: TaskActivityChange[],
    field: TaskActivityField,
    from: unknown,
    to: unknown,
) {
    changes.push({ field, from, to });
}

function sameLabels(a: string[], b: string[]) {
    if (a.length !== b.length) return false;
    const left = a.toSorted();
    const right = b.toSorted();
    return left.every((name, index) => name === right[index]);
}

function samePerson(
    a: TaskActivitySnapshot["assignee"],
    b: TaskActivitySnapshot["assignee"],
) {
    return (a?.id ?? null) === (b?.id ?? null);
}

function samePr(
    a: TaskActivitySnapshot["pr"],
    b: TaskActivitySnapshot["pr"],
) {
    return (a?.number ?? null) === (b?.number ?? null) && (a?.state ?? null) === (b?.state ?? null);
}
