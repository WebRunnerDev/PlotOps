import { describe, expect, it, vi } from "vitest";

import { createMutationQueue } from "./create-mutation-queue";

describe("createMutationQueue", () => {
    it("runs enqueued operations one at a time in order", async () => {
        const queue = createMutationQueue();
        const order: number[] = [];

        const first = queue.enqueue(async () => {
            order.push(1);
            await new Promise((resolve) => setTimeout(resolve, 10));
            order.push(2);
        });
        const second = queue.enqueue(async () => {
            order.push(3);
        });

        await Promise.all([first, second]);
        expect(order).toEqual([1, 2, 3]);
    });

    it("continues the queue after a rejected operation", async () => {
        const queue = createMutationQueue();
        const run = vi.fn(async () => "ok");

        await queue
            .enqueue(async () => {
                throw new Error("fail");
            })
            .catch(() => {});
        await queue.enqueue(run);

        expect(run).toHaveBeenCalledOnce();
    });
});
