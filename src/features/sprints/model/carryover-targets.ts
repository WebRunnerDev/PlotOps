/** UI / dialog target for incomplete Close carryover. */
export type CarryoverTarget = "backlog" | "new" | (string & {});

/** Default all incomplete Tasks to Backlog. */
export function defaultCarryoverByTaskId(
    incompleteTaskIds: readonly string[]
): Record<string, CarryoverTarget> {
    const result: Record<string, CarryoverTarget> = {};
    for (const id of incompleteTaskIds) {
        result[id] = "backlog";
    }
    return result;
}

/**
 * Close Sprint: member Task ids that were not marked completed.
 */
export function incompleteMemberTaskIds(
    memberTaskIds: readonly string[],
    completedIds: ReadonlySet<string>
): string[] {
    return memberTaskIds.filter((id) => !completedIds.has(id));
}

/**
 * Resolve dialog targets to RPC sprint ids (`null` = Backlog).
 * `"new"` becomes `createdDraftId` when a Draft was created for this Close.
 */
export function resolveCarryoverSprintIds(
    byTaskId: Readonly<Record<string, CarryoverTarget>>,
    createdDraftId: null | string
): Record<string, null | string> {
    const result: Record<string, null | string> = {};
    for (const [taskId, target] of Object.entries(byTaskId)) {
        if (target === "backlog") {
            result[taskId] = null;
        } else if (target === "new") {
            result[taskId] = createdDraftId;
        } else {
            result[taskId] = target;
        }
    }
    return result;
}

/** Bulk helper: set every incomplete Task to the same target. */
export function setAllCarryoverTargets(
    byTaskId: Readonly<Record<string, CarryoverTarget>>,
    target: CarryoverTarget
): Record<string, CarryoverTarget> {
    const result: Record<string, CarryoverTarget> = {};
    for (const id of Object.keys(byTaskId)) {
        result[id] = target;
    }
    return result;
}

/**
 * Summarize a Closed event `carryover_by_task_id` map for the sprint report.
 */
export function summarizeCarryoverByTaskId(
    map: unknown
): null | { backlogCount: number; draftCount: number } {
    if (map === null || typeof map !== "object" || Array.isArray(map)) {
        return null;
    }

    let backlogCount = 0;
    let draftCount = 0;
    const entries = Object.values(map as Record<string, unknown>);
    if (entries.length === 0) {
        return null;
    }
    for (const value of entries) {
        if (value === null || value === undefined || value === "") {
            backlogCount += 1;
        } else {
            draftCount += 1;
        }
    }
    return { backlogCount, draftCount };
}

/**
 * Keep targets for still-incomplete Tasks; drop completed; default new ones
 * to Backlog.
 */
export function syncCarryoverByTaskId(
    previous: Readonly<Record<string, CarryoverTarget>>,
    incompleteTaskIds: readonly string[]
): Record<string, CarryoverTarget> {
    const result: Record<string, CarryoverTarget> = {};
    for (const id of incompleteTaskIds) {
        result[id] = previous[id] ?? "backlog";
    }
    return result;
}
