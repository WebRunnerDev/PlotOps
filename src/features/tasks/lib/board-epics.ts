import type {
    EpicColor,
    ProjectEpic,
    TaskType,
} from "@/features/tasks/model/types";

import { effectiveEpicId } from "./epic-rules";

/** Epic chip data for a card / row — the Task's own Epic or its Parent's. */
export type TaskCardEpic = {
    color?: EpicColor;
    key: string;
    title: string;
};

/** Epic chip for a card / row: the Task's own Epic, or its Parent's. */
export function resolveCardEpic(
    task: { epicId?: string; parentEpicId?: string },
    epicsById: ReadonlyMap<string, ProjectEpic>
): TaskCardEpic | undefined {
    const epicId = effectiveEpicId(task);
    if (!epicId) return undefined;
    const epic = epicsById.get(epicId);
    if (!epic) return undefined;
    return { color: epic.color, key: epic.key, title: epic.title };
}

/**
 * Epics are planning containers, not cards: Kanban columns and Backlog
 * Sprint/Backlog lists never show them (Backlog lists them in the Epics panel).
 */
export function withoutEpics<T extends { type: TaskType }>(
    tasks: readonly T[]
): T[] {
    return tasks.filter((task) => task.type !== "epic");
}
