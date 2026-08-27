export type BoardColumn = {
    id: string;
    /** Close Sprint pre-checks Tasks in this column as completed. ≤1 per board. */
    isDone: boolean;
    name: string;
};

/** Mirrors tasks.TaskType — kept local so `boards` stays a leaf module. */
export type BoardDefaultTaskType = "bug" | "feature" | "task";

export type ProjectBoardRecord = {
    allowedHeadPatterns: string[];
    /** Assign new Tasks on this Board to the creator when the Team is solo. */
    autoAssignToCreator: boolean;
    baseBranch: string;
    /** Prefill for new Tasks created on this board when type is omitted. */
    defaultTaskType: BoardDefaultTaskType;
    id: string;
    name: string;
    position: number;
    projectId: string;
};
