import type { BoardSprintScope } from "./types";

/**
 * When Active scope is selected but no sprint is running (or sprints are still
 * loading), treat the board as Entire so backlog tasks stay visible — matches
 * BoardSprintControls highlight state.
 */
export function resolveEffectiveBoardSprintScope(input: {
    boardSprintScope: BoardSprintScope;
    hasActiveSprint: boolean;
}): BoardSprintScope {
    if (input.boardSprintScope === "active" && !input.hasActiveSprint) {
        return "entire";
    }
    return input.boardSprintScope;
}
