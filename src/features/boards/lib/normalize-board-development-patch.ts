import type { UpdateBoardPatch } from "@/features/boards/model/types";

type DevelopmentPatch = Pick<
    UpdateBoardPatch,
    | "allowed_head_patterns"
    | "base_branch"
    | "is_development"
    | "merge_target_column_id"
    | "merge_target_mode"
>;

/**
 * Normalizes Board git-mapping fields from an update patch.
 * Non-development Boards clear Base branch and Allowed head patterns.
 * A merge target mode other than `column` clears the target column.
 */
export function normalizeBoardDevelopmentPatch(
    patch: DevelopmentPatch
): DevelopmentPatch {
    const merge =
        patch.merge_target_mode !== undefined &&
        patch.merge_target_mode !== "column"
            ? { merge_target_column_id: null }
            : {};

    if (patch.is_development === false) {
        return {
            ...patch,
            ...merge,
            allowed_head_patterns: [],
            base_branch: null,
            is_development: false,
        };
    }

    if (patch.base_branch === undefined) {
        return { ...patch, ...merge };
    }

    return {
        ...patch,
        ...merge,
        base_branch: patch.base_branch?.trim() || null,
    };
}
