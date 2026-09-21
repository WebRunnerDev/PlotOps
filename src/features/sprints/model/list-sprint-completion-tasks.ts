/**
 * Closed Sprint report: completed snapshot with optional live Task rows
 * (still members or later reassigned / missing). `inBacklog` marks rows that
 * can rejoin the Closed Sprint (see tasks_sprint_guard).
 */
export function listSprintCompletionTasks<
    T extends { id: string; key: string; sprintId?: string; title: string },
>(input: {
    completedTaskIds: readonly string[];
    sprintId: string;
    tasks: ReadonlyArray<T>;
}): Array<{
    id: string;
    inBacklog: boolean;
    key?: string;
    stillMember: boolean;
    title?: string;
}> {
    const byId = new Map(input.tasks.map((task) => [task.id, task]));
    return input.completedTaskIds.map((id) => {
        const task = byId.get(id);
        return {
            id,
            inBacklog: task !== undefined && !task.sprintId,
            key: task?.key,
            stillMember: task?.sprintId === input.sprintId,
            title: task?.title,
        };
    });
}
