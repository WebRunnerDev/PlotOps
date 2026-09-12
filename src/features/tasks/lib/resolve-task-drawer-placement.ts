export const TASK_DRAWER_SIDES = ["bottom", "left", "right"] as const;

export type TaskDrawerSide = (typeof TASK_DRAWER_SIDES)[number];

export const DEFAULT_SIDE_DRAWER_WIDTH_PX = 576;
export const MIN_SIDE_DRAWER_WIDTH_PX = 320;
export const MAX_SIDE_DRAWER_WIDTH_PX = 896;
/** Drag this far past min width toward the outside edge to dismiss. */
export const SIDE_DRAWER_CLOSE_SLACK_PX = 72;
/** Wheel delta → width px (1:1 with device pixels; trackpads already scale). */
export const SIDE_DRAWER_WHEEL_SENSITIVITY = 1;
/** Accumulated wheel px before stepping bottom-sheet snap up/down. */
export const BOTTOM_DRAWER_WHEEL_STEP_PX = 48;

export type TaskDrawerPlacement = {
    contentClassName?: string;
    contentStyle?: { [key: string]: string };
    isSide: boolean;
    swipeDirection: "down" | "left" | "right";
    useSnapPoints: boolean;
};

const DEFAULT_VIEWPORT_WIDTH_PX = 1280;

export type BottomDrawerWheelStepResult = {
    didStep: boolean;
    nextAccumulatedDelta: number;
    /** Next snap index, or `null` to dismiss past the compact snap. */
    nextIndex: null | number;
};

export type SideDrawerPointerDragResult = {
    shouldClose: boolean;
    widthPx: number;
};

/** Signed wheel intent: positive expands the bottom sheet. */
export function bottomDrawerWheelIntent(
    deltaX: number,
    deltaY: number
): number {
    return Math.abs(deltaY) >= Math.abs(deltaX) ? -deltaY : -deltaX;
}

/** Clamp persisted / dragged width against viewport. */
export function clampSideDrawerWidth(
    widthPx: number,
    viewportWidthPx = DEFAULT_VIEWPORT_WIDTH_PX
): number {
    if (!Number.isFinite(widthPx)) {
        return DEFAULT_SIDE_DRAWER_WIDTH_PX;
    }
    const maxForViewport = Math.max(
        MIN_SIDE_DRAWER_WIDTH_PX,
        Math.floor(viewportWidthPx * 0.92)
    );
    const max = Math.min(MAX_SIDE_DRAWER_WIDTH_PX, maxForViewport);
    return Math.min(
        max,
        Math.max(MIN_SIDE_DRAWER_WIDTH_PX, Math.round(widthPx))
    );
}

/**
 * Wheel resize/snap engages only while Alt (Option) is held. Ctrl and Cmd are
 * browser zoom and Shift is horizontal scroll, so they stay with the browser.
 */
export function hasDrawerWheelModifier(event: {
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
}): boolean {
    return event.altKey && !event.ctrlKey && !event.metaKey;
}

export function isTaskDrawerSide(value: unknown): value is TaskDrawerSide {
    return value === "bottom" || value === "left" || value === "right";
}

/** After create: open drawer only when the preference is on. */
export function maybeSelectCreatedTask(
    taskId: string,
    options: {
        openAfterCreate: boolean;
        selectTask: (id: string) => void;
    }
): void {
    if (!options.openAfterCreate) return;
    options.selectTask(taskId);
}

/**
 * Accumulate wheel deltas into discrete snap steps (and dismiss past min).
 */
export function resolveBottomDrawerWheelStep(input: {
    accumulatedDelta: number;
    activeIndex: number;
    snapPointCount: number;
    stepPx?: number;
}): BottomDrawerWheelStepResult {
    const stepPx = input.stepPx ?? BOTTOM_DRAWER_WHEEL_STEP_PX;
    const { accumulatedDelta, activeIndex, snapPointCount } = input;

    if (accumulatedDelta >= stepPx) {
        if (activeIndex >= snapPointCount - 1) {
            return {
                didStep: false,
                nextAccumulatedDelta: 0,
                nextIndex: activeIndex,
            };
        }
        return {
            didStep: true,
            nextAccumulatedDelta: 0,
            nextIndex: activeIndex + 1,
        };
    }

    if (accumulatedDelta <= -stepPx) {
        if (activeIndex <= 0) {
            return {
                didStep: true,
                nextAccumulatedDelta: 0,
                nextIndex: null,
            };
        }
        return {
            didStep: true,
            nextAccumulatedDelta: 0,
            nextIndex: activeIndex - 1,
        };
    }

    return {
        didStep: false,
        nextAccumulatedDelta: accumulatedDelta,
        nextIndex: activeIndex,
    };
}

/**
 * One free-edge drag: grow/shrink width (like bottom snap), or dismiss when
 * pulled past the compact minimum toward the outside.
 */
export function resolveSideDrawerPointerDrag(input: {
    clientX: number;
    side: "left" | "right";
    startClientX: number;
    startWidthPx: number;
    viewportWidthPx?: number;
}): SideDrawerPointerDragResult {
    const delta =
        input.side === "left"
            ? input.clientX - input.startClientX
            : input.startClientX - input.clientX;
    return resolveSideDrawerWidthChange(
        input.startWidthPx + delta,
        input.viewportWidthPx
    );
}

/**
 * Wheel over the free-edge handle: scroll up / toward the panel expands;
 * scroll down / away shrinks; past compact min + slack dismisses.
 */
export function resolveSideDrawerWheelDelta(input: {
    deltaX: number;
    deltaY: number;
    side: "left" | "right";
    viewportWidthPx?: number;
    widthPx: number;
}): SideDrawerPointerDragResult {
    const primary =
        Math.abs(input.deltaY) >= Math.abs(input.deltaX)
            ? -input.deltaY
            : input.side === "left"
              ? input.deltaX
              : -input.deltaX;
    return resolveSideDrawerWidthChange(
        input.widthPx + primary * SIDE_DRAWER_WHEEL_SENSITIVITY,
        input.viewportWidthPx
    );
}

/** Maps viewer preference to Drawer swipe / snap / width. */
export function resolveTaskDrawerPlacement(
    side: TaskDrawerSide,
    sideWidthPx: number = DEFAULT_SIDE_DRAWER_WIDTH_PX,
    viewportWidthPx = DEFAULT_VIEWPORT_WIDTH_PX
): TaskDrawerPlacement {
    if (side === "left" || side === "right") {
        const widthPx = clampSideDrawerWidth(sideWidthPx, viewportWidthPx);
        return {
            contentClassName:
                "data-[swipe-axis=x]:[--drawer-content-width:var(--task-drawer-side-width)] sm:data-[swipe-axis=x]:[--drawer-content-width:var(--task-drawer-side-width)]",
            contentStyle: {
                "--task-drawer-side-width": `${widthPx}px`,
            },
            isSide: true,
            swipeDirection: side,
            useSnapPoints: false,
        };
    }
    return {
        isSide: false,
        swipeDirection: "down",
        useSnapPoints: true,
    };
}

function resolveSideDrawerWidthChange(
    rawWidth: number,
    viewportWidthPx?: number
): SideDrawerPointerDragResult {
    if (rawWidth < MIN_SIDE_DRAWER_WIDTH_PX - SIDE_DRAWER_CLOSE_SLACK_PX) {
        return {
            shouldClose: true,
            widthPx: MIN_SIDE_DRAWER_WIDTH_PX,
        };
    }
    return {
        shouldClose: false,
        widthPx: clampSideDrawerWidth(rawWidth, viewportWidthPx),
    };
}
