/** A Board column as the flow reports see it, in Board order. */
export type FlowColumn = {
    id: string;
    isDone: boolean;
    name: string;
};

/**
 * Status history of one Board's Tasks (`get_board_flow_history`).
 * `changes` holds the full history of every Task that changed inside the
 * window; a Task without changes sat in its current column throughout.
 */
export type FlowHistory = {
    changes: FlowStatusChange[];
    tasks: FlowTask[];
};

/** Report window, in days back from today (today included). */
export type FlowRangeDays = 14 | 30 | 90;

export const FLOW_RANGE_DAYS: readonly FlowRangeDays[] = [14, 30, 90];

/**
 * One column change (`task_status_changes`). `fromStatus` null marks the
 * Task's creation. Names are snapshots taken at the time of the change, so
 * history from another Board maps onto this Board's columns by name.
 */
export type FlowStatusChange = {
    changedAt: string;
    fromStatus: null | string;
    fromStatusName: null | string;
    taskId: string;
    toStatus: string;
    toStatusName: null | string;
};

export type FlowTask = {
    archivedAt: null | string;
    createdAt: string;
    id: string;
    key: string;
    status: string;
    title: string;
};
