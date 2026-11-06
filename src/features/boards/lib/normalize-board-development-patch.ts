import type {
    BoardRepositoryBaseBranch,
    UpdateBoardPatch,
} from "@/features/boards/model/types";

type DevelopmentPatch = Pick<
    UpdateBoardPatch,
    | "allowed_head_patterns"
    | "is_development"
    | "merge_target_column_id"
    | "merge_target_mode"
    | "repository_base_branches"
>;

/**
 * Normalizes Board git-mapping fields from an update patch.
 * Non-development Boards clear Base branches and Allowed head patterns.
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
            is_development: false,
            repository_base_branches: [],
        };
    }

    if (patch.repository_base_branches === undefined) {
        return { ...patch, ...merge };
    }

    return {
        ...patch,
        ...merge,
        repository_base_branches: normalizeRepositoryBaseBranches(
            patch.repository_base_branches
        ),
    };
}

/** Trims each Base branch and drops blank ones (a blank keeps the stored value). */
export function normalizeRepositoryBaseBranches(
    entries: readonly BoardRepositoryBaseBranch[]
): BoardRepositoryBaseBranch[] {
    return entries
        .map((entry) => ({
            baseBranch: entry.baseBranch.trim(),
            repositoryId: entry.repositoryId,
        }))
        .filter((entry) => entry.baseBranch.length > 0);
}
