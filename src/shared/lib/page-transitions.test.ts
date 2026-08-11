import { afterEach, describe, expect, it, vi } from "vitest";

import { waitForActiveViewTransition } from "@/shared/lib/page-transitions";

describe("waitForActiveViewTransition", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("resolves immediately when document is unavailable", async () => {
        vi.stubGlobal("document");
        await expect(waitForActiveViewTransition()).resolves.toBeUndefined();
    });

    it("resolves immediately when no transition is active", async () => {
        vi.stubGlobal("document", {
            getAnimations: () => [],
        });
        await expect(waitForActiveViewTransition()).resolves.toBeUndefined();
    });

    it("awaits document.activeViewTransition.finished", async () => {
        let resolveFinished!: () => void;
        const finished = new Promise<void>((resolve) => {
            resolveFinished = resolve;
        });
        vi.stubGlobal("document", {
            activeViewTransition: { finished },
            getAnimations: () => [],
        });

        let settled = false;
        const pending = waitForActiveViewTransition().then(() => {
            settled = true;
        });

        await Promise.resolve();
        await Promise.resolve();
        expect(settled).toBe(false);

        resolveFinished();
        await pending;
        expect(settled).toBe(true);
    });

    it("resolves when finished rejects (skipped transition)", async () => {
        vi.stubGlobal("document", {
            activeViewTransition: {
                finished: Promise.reject(new Error("skipped")),
            },
            getAnimations: () => [],
        });

        await expect(waitForActiveViewTransition()).resolves.toBeUndefined();
    });
});
