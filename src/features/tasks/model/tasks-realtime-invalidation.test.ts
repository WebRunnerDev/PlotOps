import { describe, expect, it, vi } from "vitest";

import { createTasksRealtimeInvalidationController } from "./tasks-realtime-invalidation";

const noopCancel = () => {};

describe("createTasksRealtimeInvalidationController", () => {
    it("does not invalidate while a move is pending; flushes once after settle", () => {
        const invalidate = vi.fn();
        const pendingMoveCount = 1;
        const scheduled: Array<{ callback: () => void; ms: number }> = [];

        const controller = createTasksRealtimeInvalidationController({
            debounceMs: 50,
            invalidate,
            pendingMoveCount: () => pendingMoveCount,
            schedule: (callback, ms) => {
                scheduled.push({ callback, ms });
                return () => {
                    const index = scheduled.findIndex(
                        (entry) => entry.callback === callback
                    );
                    if (index !== -1) scheduled.splice(index, 1);
                };
            },
        });

        // Realtime echo of our own write while mutation still running side effects
        controller.requestInvalidation();
        controller.requestInvalidation();
        expect(invalidate).not.toHaveBeenCalled();
        expect(scheduled).toHaveLength(0);

        // onSettled: this mutation is still counted as pending (TanStack).
        controller.onMoveSettled();
        expect(invalidate).not.toHaveBeenCalled();
        expect(scheduled).toHaveLength(1);

        scheduled[0]?.callback();
        expect(invalidate).toHaveBeenCalledTimes(1);
        controller.dispose();
    });

    it("coalesces burst Realtime + settle into one debounced invalidate", () => {
        const invalidate = vi.fn();
        const scheduled: Array<{ callback: () => void }> = [];

        const controller = createTasksRealtimeInvalidationController({
            debounceMs: 50,
            invalidate,
            pendingMoveCount: () => 0,
            schedule: (callback) => {
                scheduled.length = 0;
                scheduled.push({ callback });
                return () => {
                    scheduled.length = 0;
                };
            },
        });

        controller.requestInvalidation();
        controller.requestInvalidation();
        controller.onMoveSettled();
        expect(invalidate).not.toHaveBeenCalled();
        expect(scheduled).toHaveLength(1);

        scheduled[0]?.callback();
        expect(invalidate).toHaveBeenCalledTimes(1);
        controller.dispose();
    });

    it("defers settle flush when another move is still pending", () => {
        const invalidate = vi.fn();
        let pendingMoveCount = 2;
        const scheduled: Array<{ callback: () => void }> = [];

        const controller = createTasksRealtimeInvalidationController({
            debounceMs: 10,
            invalidate,
            pendingMoveCount: () => pendingMoveCount,
            schedule: (callback) => {
                scheduled.push({ callback });
                return noopCancel;
            },
        });

        controller.requestInvalidation();
        controller.onMoveSettled(); // first of two overlapping moves
        expect(invalidate).not.toHaveBeenCalled();
        expect(scheduled).toHaveLength(0);

        pendingMoveCount = 1; // only the settling mutation remains
        controller.onMoveSettled();
        expect(scheduled).toHaveLength(1);
        scheduled[0]?.callback();
        expect(invalidate).toHaveBeenCalledTimes(1);
        controller.dispose();
    });
});
