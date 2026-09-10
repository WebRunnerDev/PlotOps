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
 * Kanban live board: Active scope = members of the selected Active Sprints
 * (union; empty selection → empty board). Entire board = all Tasks except
 * members of Closed Sprints (completed history stays on the Closed Sprint —
 * ADR 0021).
 */
export function filterLiveBoardTasks<T extends LiveBoardTask>(input: {
    activeSprintIds: ReadonlyArray<string>;
    scope: BoardSprintScope;
    sprints: ReadonlyArray<LiveBoardSprint>;
    tasks: ReadonlyArray<T>;
}): T[] {
    if (input.scope === "active") {
        if (input.activeSprintIds.length === 0) return [];
        const selected = new Set(input.activeSprintIds);
        return input.tasks.filter(
            (task) => task.sprintId !== undefined && selected.has(task.sprintId)
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
