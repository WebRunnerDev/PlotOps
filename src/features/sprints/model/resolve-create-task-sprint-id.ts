import type { BoardSprintScope } from "@/features/sprints/model/types";

export type CreateTaskSprintResolution =
    | { mode: "backlog" }
    | { mode: "pick"; sprintIds: readonly string[] }
    | { mode: "sprint"; sprintId: string };

/**
 * Where a new Kanban Task joins a Sprint.
 * Active scope + exactly one selected Active → that Sprint.
 * Active scope + multiple selected → caller must pick (no Backlog option).
 * Entire board (or no selection) → Backlog.
 */
export function resolveCreateTaskSprint(input: {
    boardSprintScope: BoardSprintScope;
    selectedActiveSprintIds: readonly string[];
}): CreateTaskSprintResolution {
    if (input.boardSprintScope !== "active") {
        return { mode: "backlog" };
    }
    if (input.selectedActiveSprintIds.length === 1) {
        return {
            mode: "sprint",
            sprintId: input.selectedActiveSprintIds[0]!,
        };
    }
    if (input.selectedActiveSprintIds.length > 1) {
        return {
            mode: "pick",
            sprintIds: input.selectedActiveSprintIds,
        };
    }
    return { mode: "backlog" };
}
