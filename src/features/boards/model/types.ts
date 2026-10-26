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

/**
 * Development Board: where `github-webhook` moves a Task after its PR merges
 * into the Base branch. `column` uses `mergeTargetColumnId`.
 */
export type BoardMergeTargetMode = "column" | "last_column" | "none";

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
    /** Set when `mergeTargetMode === "column"`. */
    mergeTargetColumnId: null | string;
    mergeTargetMode: BoardMergeTargetMode;
    name: string;
    position: number;
    projectId: string;
};

export type UpdateBoardPatch = {
    allowed_head_patterns?: string[];
    auto_assign_to_creator?: boolean;
    base_branch?: null | string;
    default_task_type?: BoardDefaultTaskType;
    is_development?: boolean;
    merge_target_column_id?: null | string;
    merge_target_mode?: BoardMergeTargetMode;
    name?: string;
    position?: number;
};
