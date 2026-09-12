import { describe, expect, it, vi } from "vitest";

import {
    BOTTOM_DRAWER_WHEEL_STEP_PX,
    clampSideDrawerWidth,
    DEFAULT_SIDE_DRAWER_WIDTH_PX,
    hasDrawerWheelModifier,
    isTaskDrawerSide,
    MAX_SIDE_DRAWER_WIDTH_PX,
    maybeSelectCreatedTask,
    MIN_SIDE_DRAWER_WIDTH_PX,
    resolveBottomDrawerWheelStep,
    resolveSideDrawerPointerDrag,
    resolveSideDrawerWheelDelta,
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

describe("resolveSideDrawerWheelDelta", () => {
    it("expands when scrolling up", () => {
        expect(
            resolveSideDrawerWheelDelta({
                deltaX: 0,
                deltaY: -40,
                side: "right",
                widthPx: 480,
            })
        ).toEqual({ shouldClose: false, widthPx: 520 });
    });

    it("expands a left drawer when scrolling right dominates", () => {
        expect(
            resolveSideDrawerWheelDelta({
                deltaX: 32,
                deltaY: 8,
                side: "left",
                widthPx: 480,
            })
        ).toEqual({ shouldClose: false, widthPx: 512 });
    });

    it("closes when wheeled past the compact minimum toward the outside", () => {
        expect(
            resolveSideDrawerWheelDelta({
                deltaX: 0,
                deltaY:
                    480 -
                    MIN_SIDE_DRAWER_WIDTH_PX +
                    SIDE_DRAWER_CLOSE_SLACK_PX +
                    1,
                side: "right",
                widthPx: 480,
            }).shouldClose
        ).toBe(true);
    });
});

describe("resolveBottomDrawerWheelStep", () => {
    it("expands to the next snap after enough upward scroll", () => {
        expect(
            resolveBottomDrawerWheelStep({
                accumulatedDelta: BOTTOM_DRAWER_WHEEL_STEP_PX,
                activeIndex: 0,
                snapPointCount: 2,
            })
        ).toEqual({
            didStep: true,
            nextAccumulatedDelta: 0,
            nextIndex: 1,
        });
    });

    it("dismisses when wheeled down past the compact snap", () => {
        expect(
            resolveBottomDrawerWheelStep({
                accumulatedDelta: -BOTTOM_DRAWER_WHEEL_STEP_PX,
                activeIndex: 0,
                snapPointCount: 2,
            })
        ).toEqual({
            didStep: true,
            nextAccumulatedDelta: 0,
            nextIndex: null,
        });
    });

    it("keeps accumulating below the step threshold", () => {
        expect(
            resolveBottomDrawerWheelStep({
                accumulatedDelta: BOTTOM_DRAWER_WHEEL_STEP_PX - 1,
                activeIndex: 0,
                snapPointCount: 2,
            })
        ).toEqual({
            didStep: false,
            nextAccumulatedDelta: BOTTOM_DRAWER_WHEEL_STEP_PX - 1,
            nextIndex: 0,
        });
    });
});

describe("hasDrawerWheelModifier", () => {
    it("engages on Alt alone", () => {
        expect(
            hasDrawerWheelModifier({
                altKey: true,
                ctrlKey: false,
                metaKey: false,
            })
        ).toBe(true);
    });

    it("leaves plain wheel and browser zoom combos to the page", () => {
        expect(
            hasDrawerWheelModifier({
                altKey: false,
                ctrlKey: false,
                metaKey: false,
            })
        ).toBe(false);
        expect(
            hasDrawerWheelModifier({
                altKey: false,
                ctrlKey: true,
                metaKey: false,
            })
        ).toBe(false);
        expect(
            hasDrawerWheelModifier({
                altKey: true,
                ctrlKey: true,
                metaKey: false,
            })
        ).toBe(false);
        expect(
            hasDrawerWheelModifier({
                altKey: true,
                ctrlKey: false,
                metaKey: true,
            })
        ).toBe(false);
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
