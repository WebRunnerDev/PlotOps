/**
 * Whether a merge GitHub reports may be written to the Git link as
 * `pr_state = merged`. Same rule as `github-webhook` (ADR 0035): a PR merged
 * into a branch other than the Board's Base branch stays pending for the
 * Board, so its stored state must not say merged — otherwise the Task's
 * merge set could complete early and move the Task.
 *
 * No Base branch (not a Development Board) or an unknown PR base leaves
 * nothing to wait on, so the merge is stored.
 */
export function storesMergedPrState(input: {
    baseRef: string | undefined;
    boardBase: null | string;
}): boolean {
    if (!input.boardBase || !input.baseRef) return true;
    return input.baseRef === input.boardBase;
}
