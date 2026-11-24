import type {
    GuestBoard,
    GuestSandbox,
    GuestStatusChange,
    GuestTask,
} from "../model/types";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/**
 * Guest mirror of the `tasks_record_status_change` trigger: append one
 * status change for every Task created, moved to another column or moved to
 * another Board between two sandbox snapshots. Mutates `next`.
 */
export function recordGuestStatusChanges(
    previous: GuestSandbox,
    next: GuestSandbox,
    now: Date = new Date()
): void {
    const before = new Map(previous.tasks.map((task) => [task.id, task]));
    const changedAt = now.toISOString();
    const recorded: GuestStatusChange[] = [];

    for (const task of next.tasks) {
        const old = before.get(task.id);
        if (old && old.status === task.status && old.boardId === task.boardId) {
            continue;
        }
        recorded.push({
            boardId: task.boardId,
            changedAt,
            fromStatus: old ? old.status : null,
            fromStatusName: old
                ? columnName(previous.boards, old.boardId, old.status)
                : null,
            id: crypto.randomUUID(),
            taskId: task.id,
            toStatus: task.status,
            toStatusName: columnName(next.boards, task.boardId, task.status),
        });
    }

    if (recorded.length === 0) return;
    next.statusChanges = [...(next.statusChanges ?? []), ...recorded];
}

/**
 * Demo column history relative to today, so the flow reports have something
 * to show: Done Tasks finished over the last weeks, Tasks in progress
 * started recently, and some To Do Tasks arrived inside the window (their
 * `createdAt` moves to that arrival). Deterministic per Task id.
 * Mutates `sandbox` and returns it.
 */
export function withGuestDemoStatusHistory(
    sandbox: GuestSandbox,
    now: Date = new Date()
): GuestSandbox {
    // Anchored to local midnight: the same history all day long.
    const anchor = new Date(now);
    anchor.setHours(0, 0, 0, 0);
    const nowMs = anchor.getTime();
    const changes: GuestStatusChange[] = [];

    for (const board of sandbox.boards) {
        const columns = board.columns.toSorted(
            (a, b) => a.position - b.position
        );
        if (columns.length < 2) continue;
        const marked = columns.findIndex((column) => column.isDone);
        const doneIndex = marked === -1 ? columns.length - 1 : marked;

        for (const task of sandbox.tasks) {
            if (task.boardId !== board.id || task.type === "epic") continue;
            if (task.archivedAt) continue;
            const current = columns.findIndex(
                (column) => column.id === task.status
            );
            if (current === -1) continue;

            const seed = hashId(task.id);
            const hour = ((seed >>> 20) % 7) * HOUR_MS;

            if (current === 0) {
                if (seed % 2 === 0) continue;
                const arrivedAt =
                    nowMs - (1 + ((seed >>> 1) % 25)) * DAY_MS - hour;
                task.createdAt = new Date(arrivedAt).toISOString();
                changes.push(
                    demoChange(task, board, null, columns[0]!.id, arrivedAt)
                );
                continue;
            }

            let startMs: number;
            let endMs: number;
            if (current === doneIndex) {
                endMs = nowMs - (1 + (seed % 26)) * DAY_MS - hour;
                startMs = endMs - (1 + ((seed >>> 8) % 8)) * DAY_MS - hour;
            } else {
                startMs = nowMs - (2 + (seed % 12)) * DAY_MS - hour;
                endMs = nowMs - hour;
            }

            const createdMs = Date.parse(task.createdAt);
            if (Number.isFinite(createdMs) && createdMs > startMs) {
                task.createdAt = new Date(startMs - DAY_MS).toISOString();
            }

            const gap = (endMs - startMs) / Math.max(1, current);
            for (let step = 0; step < current; step += 1) {
                const at =
                    current === doneIndex
                        ? startMs + gap * step
                        : startMs + (gap * step) / 2;
                changes.push(
                    demoChange(
                        task,
                        board,
                        columns[step]!.id,
                        columns[step + 1]!.id,
                        step === current - 1 && current === doneIndex
                            ? endMs
                            : at
                    )
                );
            }
        }
    }

    sandbox.statusChanges = changes.toSorted(
        (a, b) => Date.parse(a.changedAt) - Date.parse(b.changedAt)
    );
    return sandbox;
}

function columnName(
    boards: readonly GuestBoard[],
    boardId: string,
    status: string
): null | string {
    return (
        boards
            .find((board) => board.id === boardId)
            ?.columns.find((column) => column.id === status)?.name ?? null
    );
}

function demoChange(
    task: GuestTask,
    board: GuestBoard,
    from: null | string,
    to: string,
    at: number
): GuestStatusChange {
    return {
        boardId: board.id,
        changedAt: new Date(at).toISOString(),
        fromStatus: from,
        fromStatusName:
            from === null ? null : columnName([board], board.id, from),
        id: `${task.id}:status:${to}`,
        taskId: task.id,
        toStatus: to,
        toStatusName: columnName([board], board.id, to),
    };
}

/**
 * FNV-1a 32-bit plus a murmur3 finaliser — stable demo spread per Task id
 * (seed ids differ only in their last digits).
 */
function hashId(id: string): number {
    let hash = 0x81_1c_9d_c5;
    for (let index = 0; index < id.length; index += 1) {
        hash ^= id.codePointAt(index) ?? 0;
        hash = Math.imul(hash, 0x01_00_01_93);
    }
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x85_eb_ca_6b);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0xc2_b2_ae_35);
    hash ^= hash >>> 16;
    return hash >>> 0;
}
