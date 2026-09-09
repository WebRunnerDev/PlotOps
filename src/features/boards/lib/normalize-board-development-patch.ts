/**
 * Normalizes Board git-mapping fields from an update patch.
 * Non-development Boards clear Base branch and Allowed head patterns.
 */
export function normalizeBoardDevelopmentPatch(patch: {
    allowed_head_patterns?: string[];
    base_branch?: null | string;
    is_development?: boolean;
}): {
    allowed_head_patterns?: string[];
    base_branch?: null | string;
    is_development?: boolean;
} {
    if (patch.is_development === false) {
        return {
            ...patch,
            allowed_head_patterns: [],
            base_branch: null,
            is_development: false,
        };
    }

    if (patch.base_branch === undefined) {
        return patch;
    }

    return {
        ...patch,
        base_branch: patch.base_branch?.trim() || null,
    };
}
