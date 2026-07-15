/** Shorten branch names for kanban card chrome. */
export function formatBranchName(branchName: string, maxLength = 22): string {
    if (branchName.length <= maxLength) {
        return branchName;
    }

    return `${branchName.slice(0, Math.max(1, maxLength - 1))}…`;
}
