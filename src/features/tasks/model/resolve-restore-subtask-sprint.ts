/**
 * Restored Subtasks rejoin the Parent Task's draft/active Sprint — same as
 * create_subtask when sprintId is omitted. Root Tasks stay in Backlog.
 */
export function resolveRestoreSubtaskSprintId(input: {
    parentId?: string;
    parentSprintId?: string;
    parentSprintIsLive: boolean;
}): string | undefined {
    if (input.parentId == undefined) return undefined;
    if (!input.parentSprintIsLive) return undefined;
    return input.parentSprintId;
}
