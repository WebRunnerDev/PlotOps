import { afterEach, describe, expect, it, vi } from "vitest";

import {
    getPageTransitionTypes,
    resolveProjectSection,
    waitForActiveViewTransition,
} from "@/shared/lib/page-transitions";

describe("getPageTransitionTypes", () => {
    it("skips view transitions for search-only board URL updates", () => {
        expect(
            getPageTransitionTypes({
                fromLocation: {
                    pathname: "/projects/p1/boards/b1",
                    state: { __TSR_index: 0 },
                },
                pathChanged: false,
                toLocation: {
                    pathname: "/projects/p1/boards/b1",
                    state: { __TSR_index: 0 },
                },
            })
        ).toBe(false);
    });

    it("still fades between boards at the same section", () => {
        expect(
            getPageTransitionTypes({
                fromLocation: {
                    pathname: "/projects/p1/boards/b1",
                    state: { __TSR_index: 0 },
                },
                pathChanged: true,
                toLocation: {
                    pathname: "/projects/p1/boards/b2",
                    state: { __TSR_index: 1 },
                },
            })
        ).toEqual(["fade"]);
    });

    it("slides left along project section nav order", () => {
        expect(
            getPageTransitionTypes({
                fromLocation: {
                    pathname: "/projects/p1/boards/b1",
                    state: { __TSR_index: 0 },
                },
                pathChanged: true,
                toLocation: {
                    pathname: "/projects/p1/boards/b1/backlog",
                    state: { __TSR_index: 1 },
                },
            })
        ).toEqual(["section-slide-left"]);

        expect(
            getPageTransitionTypes({
                fromLocation: {
                    pathname: "/projects/p1/boards/b1",
                    state: { __TSR_index: 0 },
                },
                pathChanged: true,
                toLocation: {
                    pathname: "/projects/p1/settings",
                    state: { __TSR_index: 1 },
                },
            })
        ).toEqual(["section-slide-left"]);

        expect(
            getPageTransitionTypes({
                fromLocation: {
                    pathname: "/projects/p1/ci-cd",
                    state: { __TSR_index: 0 },
                },
                pathChanged: true,
                toLocation: {
                    pathname: "/projects/p1/settings",
                    state: { __TSR_index: 1 },
                },
            })
        ).toEqual(["section-slide-left"]);
    });

    it("slides right when moving earlier in project section nav", () => {
        expect(
            getPageTransitionTypes({
                fromLocation: {
                    pathname: "/projects/p1/settings",
                    state: { __TSR_index: 2 },
                },
                pathChanged: true,
                toLocation: {
                    pathname: "/projects/p1/boards/b1",
                    state: { __TSR_index: 3 },
                },
            })
        ).toEqual(["section-slide-right"]);

        expect(
            getPageTransitionTypes({
                fromLocation: {
                    pathname: "/projects/p1/boards/b1/backlog",
                    state: { __TSR_index: 2 },
                },
                pathChanged: true,
                toLocation: {
                    pathname: "/projects/p1/boards/b1",
                    state: { __TSR_index: 3 },
                },
            })
        ).toEqual(["section-slide-right"]);
    });

    it("fades when crossing projects even if sections match", () => {
        expect(
            getPageTransitionTypes({
                fromLocation: {
                    pathname: "/projects/p1/settings",
                    state: { __TSR_index: 0 },
                },
                pathChanged: true,
                toLocation: {
                    pathname: "/projects/p2/settings",
                    state: { __TSR_index: 1 },
                },
            })
        ).toEqual(["fade"]);
    });

    it("fades between project and non-project shells", () => {
        expect(
            getPageTransitionTypes({
                fromLocation: {
                    pathname: "/home",
                    state: { __TSR_index: 0 },
                },
                pathChanged: true,
                toLocation: {
                    pathname: "/projects/p1/boards/b1",
                    state: { __TSR_index: 1 },
                },
            })
        ).toEqual(["fade"]);
    });
});

describe("resolveProjectSection", () => {
    it("maps project section paths", () => {
        expect(resolveProjectSection("/projects/p1/boards/b1")).toEqual({
            projectId: "p1",
            section: "board",
        });
        expect(resolveProjectSection("/projects/p1/boards/b1/backlog")).toEqual(
            {
                projectId: "p1",
                section: "backlog",
            }
        );
        expect(resolveProjectSection("/projects/p1/ci-cd")).toEqual({
            projectId: "p1",
            section: "cicd",
        });
        expect(resolveProjectSection("/projects/p1/settings")).toEqual({
            projectId: "p1",
            section: "settings",
        });
    });

    it("ignores non-section project routes", () => {
        expect(resolveProjectSection("/projects/p1")).toBeNull();
        expect(resolveProjectSection("/projects/p1/tasks/KEY-1")).toBeNull();
        expect(resolveProjectSection("/home")).toBeNull();
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
