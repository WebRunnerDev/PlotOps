import { afterEach, describe, expect, it, vi } from "vitest";

import {
    getPageTransitionTypes,
    waitForActiveViewTransition,
} from "@/shared/lib/page-transitions";

describe("getPageTransitionTypes", () => {
    it("skips view transitions for search-only board URL updates", () => {
        expect(
            getPageTransitionTypes({
                fromLocation: {
                    pathname: "/projects/p1/boards/b1",
                    state: {},
                },
                pathChanged: false,
                toLocation: {
                    pathname: "/projects/p1/boards/b1",
                    state: {},
                },
            })
        ).toBe(false);
    });

    it("still fades between routes at the same depth", () => {
        expect(
            getPageTransitionTypes({
                fromLocation: {
                    pathname: "/projects/p1/boards/b1",
                    state: {},
                },
                pathChanged: true,
                toLocation: {
                    pathname: "/projects/p1/boards/b2",
                    state: {},
                },
            })
        ).toEqual(["fade"]);
    });
});

describe("waitForActiveViewTransition", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("resolves immediately when document is unavailable", async () => {
        vi.stubGlobal("document", null);
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
