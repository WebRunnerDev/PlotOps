import { describe, expect, it, vi } from "vitest";

import {
    clampSideDrawerWidth,
    DEFAULT_SIDE_DRAWER_WIDTH_PX,
    isTaskDrawerSide,
    MAX_SIDE_DRAWER_WIDTH_PX,
    maybeSelectCreatedTask,
    MIN_SIDE_DRAWER_WIDTH_PX,
    resolveSideDrawerPointerDrag,
    resolveTaskDrawerPlacement,
    SIDE_DRAWER_CLOSE_SLACK_PX,
} from "./resolve-task-drawer-placement";

describe("resolveTaskDrawerPlacement", () => {
    it("uses a bottom sheet with snap points by default preference", () => {
        expect(resolveTaskDrawerPlacement("bottom")).toEqual({
            isSide: false,
            swipeDirection: "down",
            useSnapPoints: true,
        });
    });

    it("anchors left with a resizable side width", () => {
        const placement = resolveTaskDrawerPlacement("left", 480);
        expect(placement.swipeDirection).toBe("left");
        expect(placement.useSnapPoints).toBe(false);
        expect(placement.isSide).toBe(true);
        expect(placement.contentClassName).toMatch(/task-drawer-side-width/);
        expect(placement.contentStyle).toEqual({
            "--task-drawer-side-width": "480px",
        });
    });

    it("anchors right with a resizable side width", () => {
        const placement = resolveTaskDrawerPlacement("right", 640);
        expect(placement.swipeDirection).toBe("right");
        expect(placement.isSide).toBe(true);
        expect(placement.contentStyle).toEqual({
            "--task-drawer-side-width": "640px",
        });
    });
});

describe("clampSideDrawerWidth", () => {
    it("clamps to min and max", () => {
        expect(clampSideDrawerWidth(100)).toBe(MIN_SIDE_DRAWER_WIDTH_PX);
        expect(clampSideDrawerWidth(2000, 2000)).toBe(MAX_SIDE_DRAWER_WIDTH_PX);
        expect(clampSideDrawerWidth(DEFAULT_SIDE_DRAWER_WIDTH_PX)).toBe(
            DEFAULT_SIDE_DRAWER_WIDTH_PX
        );
    });

    it("respects viewport so the panel cannot cover nearly everything", () => {
        expect(clampSideDrawerWidth(800, 500)).toBe(Math.floor(500 * 0.92));
    });
});

describe("resolveSideDrawerPointerDrag", () => {
    it("grows a left drawer when the pointer moves right", () => {
        expect(
            resolveSideDrawerPointerDrag({
                clientX: 520,
                side: "left",
                startClientX: 480,
                startWidthPx: 480,
            })
        ).toEqual({ shouldClose: false, widthPx: 520 });
    });

    it("grows a right drawer when the pointer moves left", () => {
        expect(
            resolveSideDrawerPointerDrag({
                clientX: 440,
                side: "right",
                startClientX: 480,
                startWidthPx: 480,
            })
        ).toEqual({ shouldClose: false, widthPx: 520 });
    });

    it("closes when dragged past the compact minimum toward the outside", () => {
        expect(
            resolveSideDrawerPointerDrag({
                clientX:
                    480 -
                    (480 - MIN_SIDE_DRAWER_WIDTH_PX) -
                    SIDE_DRAWER_CLOSE_SLACK_PX -
                    1,
                side: "left",
                startClientX: 480,
                startWidthPx: 480,
            }).shouldClose
        ).toBe(true);
    });
});

describe("isTaskDrawerSide", () => {
    it("accepts known sides only", () => {
        expect(isTaskDrawerSide("bottom")).toBe(true);
        expect(isTaskDrawerSide("left")).toBe(true);
        expect(isTaskDrawerSide("right")).toBe(true);
        expect(isTaskDrawerSide("up")).toBe(false);
        expect(isTaskDrawerSide(null)).toBe(false);
    });
});

describe("maybeSelectCreatedTask", () => {
    it("selects the task when open-after-create is enabled", () => {
        const selectTask = vi.fn();
        maybeSelectCreatedTask("task-1", {
            openAfterCreate: true,
            selectTask,
        });
        expect(selectTask).toHaveBeenCalledWith("task-1");
    });

    it("skips selection when open-after-create is disabled", () => {
        const selectTask = vi.fn();
        maybeSelectCreatedTask("task-1", {
            openAfterCreate: false,
            selectTask,
        });
        expect(selectTask).not.toHaveBeenCalled();
    });
});
