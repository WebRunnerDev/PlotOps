import { describe, expect, it, vi } from "vitest";

import { createTasksRealtimeInvalidationController } from "./tasks-realtime-invalidation";

const noopCancel = () => {};

function harness(options: { invalidate: () => Promise<unknown> | void }) {
    let clock = 0;
    const timers: Array<{
        at: number;
        callback: () => void;
        id: number;
    }> = [];
    let nextId = 0;
    const controller = createTasksRealtimeInvalidationController({
        debounceMs: 250,
        invalidate: options.invalidate,
        maxWaitMs: 1000,
        now: () => clock,
        pendingMoveCount: () => 0,
        schedule: (callback, ms) => {
            const id = nextId++;
            timers.push({ at: clock + ms, callback, id });
            return () => {
                const index = timers.findIndex((t) => t.id === id);
                if (index !== -1) timers.splice(index, 1);
            };
        },
    });
    const advance = (ms: number) => {
        clock += ms;
        for (const timer of timers.filter((t) => t.at <= clock)) {
            timers.splice(timers.indexOf(timer), 1);
            timer.callback();
        }
    };
    return { advance, controller, timers };
}

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

    describe("refetch pacing", () => {
        it("merges a local write and its Realtime echo into one refetch", () => {
            const invalidate = vi.fn();
            const { advance, controller } = harness({ invalidate });

            controller.requestInvalidation(); // mutation onSettled
            advance(120);
            controller.requestInvalidation(); // Realtime echo
            advance(249);
            expect(invalidate).not.toHaveBeenCalled();

            advance(1);
            expect(invalidate).toHaveBeenCalledOnce();
        });

        it("refetches by maxWait under a continuous stream of events", () => {
            const invalidate = vi.fn();
            const { advance, controller } = harness({ invalidate });

            for (let elapsed = 0; elapsed < 1000; elapsed += 100) {
                controller.requestInvalidation();
                advance(100);
            }

            expect(invalidate).toHaveBeenCalledOnce();
        });

        it("waits for an in-flight refetch instead of cancelling it, then runs once more", async () => {
            let finish!: () => void;
            const invalidate = vi.fn(
                () =>
                    new Promise<void>((resolve) => {
                        finish = resolve;
                    })
            );
            const { advance, controller } = harness({ invalidate });

            controller.requestInvalidation();
            advance(250);
            expect(invalidate).toHaveBeenCalledTimes(1);

            controller.requestInvalidation();
            controller.requestInvalidation();
            advance(250);
            expect(invalidate).toHaveBeenCalledTimes(1); // still in flight

            finish();
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
            advance(250);
            expect(invalidate).toHaveBeenCalledTimes(2);
        });

        it("flushes a waiting refresh on dispose so leaving the Board keeps it", () => {
            const invalidate = vi.fn();
            const { controller, timers } = harness({ invalidate });

            controller.requestInvalidation();
            controller.dispose();

            expect(invalidate).toHaveBeenCalledOnce();
            expect(timers).toHaveLength(0);
        });

        it("does nothing on dispose when no refresh is waiting", () => {
            const invalidate = vi.fn();
            const { controller } = harness({ invalidate });

            controller.dispose();

            expect(invalidate).not.toHaveBeenCalled();
        });
    });
});
