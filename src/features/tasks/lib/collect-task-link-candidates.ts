import type {
    Task,
    TaskLinkKind,
    TaskLinkPeer,
} from "@/features/tasks/model/types";

import { taskLinkRefusal } from "@/features/tasks/lib/task-structure";

export type TaskLinkAddKind = "blocked_by" | "blocks" | "relates_to";

/**
 * Tasks that may be linked to `taskId` for the chosen add kind.
 * Catalog is Project-scoped — Board is not a filter.
 */
export function collectTaskLinkCandidates(input: {
    addKind: TaskLinkAddKind;
    peers: readonly TaskLinkPeer[];
    projectId: string;
    taskId: string;
    tasks: readonly Task[];
}): Task[] {
    const linkedIds = new Set(
        input.peers
            .filter((peer) =>
                input.addKind === "relates_to"
                    ? peer.kind === "relates_to"
                    : peer.kind === "blocks" &&
                      (input.addKind === "blocks"
                          ? peer.direction === "outgoing"
                          : peer.direction === "incoming")
            )
            .map((peer) => peer.otherId)
    );
    const nodes = input.tasks.map((item) => ({
        id: item.id,
        parentId: item.parentId,
        projectId: input.projectId,
    }));
    const edges = input.peers.map((peer) => ({
        kind: peer.kind,
        sourceId: peer.direction === "incoming" ? peer.otherId : input.taskId,
        targetId: peer.direction === "incoming" ? input.taskId : peer.otherId,
    }));

    return input.tasks.filter((item) => {
        if (item.archivedAt || linkedIds.has(item.id)) return false;
        const sourceId =
            input.addKind === "blocked_by" ? item.id : input.taskId;
        const targetId =
            input.addKind === "blocked_by" ? input.taskId : item.id;
        const kind: TaskLinkKind =
            input.addKind === "relates_to" ? "relates_to" : "blocks";
        return taskLinkRefusal(sourceId, targetId, kind, nodes, edges) === null;
    });
}

/** Merge Task lists by id (later lists win). */
export function mergeTaskCatalogs(lists: readonly (readonly Task[])[]): Task[] {
    const byId = new Map<string, Task>();
    for (const list of lists) {
        for (const task of list) {
            byId.set(task.id, task);
        }
    }
    return [...byId.values()];
}
