import type { BoardSprintScope } from "@/features/sprints/model/types";

/**
 * When the board is scoped to the Active Sprint, create into that sprint so the
 * new card stays visible. Entire-board scope (and missing active sprint) keep
 * the Backlog default (`sprint_id` absent).
 */
export function resolveCreateTaskSprintId(input: {
    activeSprintId: string | undefined;
    boardSprintScope: BoardSprintScope;
}): string | undefined {
    if (input.boardSprintScope !== "active") return undefined;
    return input.activeSprintId;
}
