export type BoardColumn = {
    id: string;
    /** Close Sprint pre-checks Tasks in this column as completed. ≤1 per board. */
    isDone: boolean;
    name: string;
};

/**
 * Level-0 slice of tasks.TaskType (Epic excluded by `boards_default_task_type_not_epic`).
 * Kept local so `boards` stays a leaf module.
 */
export type BoardDefaultTaskType = "bug" | "story" | "task";

export type CreateBoardInput = {
    baseBranch?: string;
    isDevelopment: boolean;
};

export type ProjectBoardRecord = {
    allowedHeadPatterns: string[];
    /** Assign new Tasks on this Board to the creator when the Team is solo. */
    autoAssignToCreator: boolean;
    /** PR merge target; required when isDevelopment. */
    baseBranch: null | string;
    /** Prefill for new Tasks created on this board when type is omitted. */
    defaultTaskType: BoardDefaultTaskType;
    id: string;
    /** Git branch mapping (Base branch + Allowed head patterns). */
    isDevelopment: boolean;
    name: string;
    position: number;
    projectId: string;
};
