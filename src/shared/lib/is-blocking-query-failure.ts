/**
 * Whether a query failure should replace the page with an error state.
 * Refetch failures keep prior `data` in TanStack Query — those must not
 * unmount the board/backlog (users see a false "no access" flash).
 */
export function isBlockingQueryFailure(input: {
    data: unknown;
    error: unknown;
}): boolean {
    return Boolean(input.error) && input.data === undefined;
}
