import type {
    FlowColumn,
    FlowHistory,
    FlowStatusChange,
    FlowTask,
} from "@/features/flow-reports/model/types";

/**
 * One Task's column over time, as indexes into the current Board's columns.
 * `initialColumn` holds from `existsFrom` until the first step.
 */
export type TaskTimeline = {
    /** Creation time: the creation change when recorded, else `created_at`. */
    existsFrom: number;
    /** Archive time, or +Infinity while the Task is live. */
    existsUntil: number;
    /** True when the Task's creation was recorded (history is complete). */
    hasCreation: boolean;
    initialColumn: number;
    steps: Array<{ at: number; column: number }>;
    task: FlowTask;
};

export function buildTaskTimelines(input: {
    columns: ReadonlyArray<FlowColumn>;
    history: FlowHistory;
}): TaskTimeline[] {
    const resolve = createFlowColumnResolver(input.columns);
    const changesByTask = new Map<string, FlowStatusChange[]>();
    for (const change of input.history.changes) {
        const list = changesByTask.get(change.taskId);
        if (list) list.push(change);
        else changesByTask.set(change.taskId, [change]);
    }

    return input.history.tasks.map((task) => {
        const changes = (changesByTask.get(task.id) ?? []).toSorted(
            (a, b) => Date.parse(a.changedAt) - Date.parse(b.changedAt)
        );
        const creation = changes.find((change) => change.fromStatus === null);
        const moves = changes.filter((change) => change.fromStatus !== null);
        const first = moves[0];

        const initialColumn = creation
            ? resolve(creation.toStatus, creation.toStatusName)
            : first
              ? resolve(first.fromStatus, first.fromStatusName)
              : resolve(task.status, null);

        return {
            existsFrom: Date.parse(creation?.changedAt ?? task.createdAt),
            existsUntil: task.archivedAt
                ? Date.parse(task.archivedAt)
                : Number.POSITIVE_INFINITY,
            hasCreation: creation !== undefined,
            initialColumn,
            steps: moves.map((change) => ({
                at: Date.parse(change.changedAt),
                column: resolve(change.toStatus, change.toStatusName),
            })),
            task,
        };
    });
}

/** Column index at instant `at`, or null when the Task did not exist. */
export function columnAt(timeline: TaskTimeline, at: number): null | number {
    if (at < timeline.existsFrom || at >= timeline.existsUntil) return null;
    let column = timeline.initialColumn;
    for (const step of timeline.steps) {
        if (step.at > at) break;
        column = step.column;
    }
    return column;
}

/**
 * Maps a recorded status onto the current Board's columns. A Task moved
 * from another Board is counted by this Board's columns: same id and name,
 * then same name, then same id; anything else lands in the first column.
 */
export function createFlowColumnResolver(
    columns: ReadonlyArray<FlowColumn>
): (id: null | string, name: null | string) => number {
    const byId = new Map(columns.map((column, index) => [column.id, index]));
    const byName = new Map<string, number>();
    for (const [index, column] of columns.entries()) {
        const key = normalizeName(column.name);
        if (!byName.has(key)) byName.set(key, index);
    }

    return (id, name) => {
        const idIndex = id === null ? undefined : byId.get(id);
        const nameIndex =
            name === null ? undefined : byName.get(normalizeName(name));

        if (idIndex !== undefined && nameIndex === idIndex) return idIndex;
        if (nameIndex !== undefined) return nameIndex;
        if (idIndex !== undefined) return idIndex;
        return 0;
    };
}

/**
 * Index of the Board's Done column: the one marked Done, else the rightmost
 * (same fallback as Close Sprint). -1 for a Board without columns.
 */
export function resolveDoneColumnIndex(
    columns: ReadonlyArray<FlowColumn>
): number {
    const marked = columns.findIndex((column) => column.isDone);
    return marked === -1 ? columns.length - 1 : marked;
}

function normalizeName(name: string): string {
    return name.trim().toLowerCase();
}
