import type { BoardSprintScope, SprintState } from "./types";

type LiveBoardSprint = {
    id: string;
    state: SprintState;
};

type LiveBoardTask = {
    id: string;
    sprintId?: string;
};

/**
 * Kanban live board: Active scope = Active members only.
 * Entire board = all Tasks except members of Closed Sprints
 * (completed history stays on the Closed Sprint — ADR 0021).
 */
export function filterLiveBoardTasks<T extends LiveBoardTask>(input: {
    activeSprintId?: string;
    scope: BoardSprintScope;
    sprints: ReadonlyArray<LiveBoardSprint>;
    tasks: ReadonlyArray<T>;
}): T[] {
    if (input.scope === "active") {
        if (!input.activeSprintId) return [];
        return input.tasks.filter(
            (task) => task.sprintId === input.activeSprintId
        );
    }

    const closedSprintIds = new Set(
        input.sprints
            .filter((sprint) => sprint.state === "closed")
            .map((sprint) => sprint.id)
    );

    return input.tasks.filter(
        (task) => !task.sprintId || !closedSprintIds.has(task.sprintId)
    );
}
