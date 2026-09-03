export const TASK_DRAWER_SIDES = ["bottom", "left", "right"] as const;

export type TaskDrawerSide = (typeof TASK_DRAWER_SIDES)[number];

export const DEFAULT_SIDE_DRAWER_WIDTH_PX = 576;
export const MIN_SIDE_DRAWER_WIDTH_PX = 320;
export const MAX_SIDE_DRAWER_WIDTH_PX = 896;
/** Drag this far past min width toward the outside edge to dismiss. */
export const SIDE_DRAWER_CLOSE_SLACK_PX = 72;

export type TaskDrawerPlacement = {
    contentClassName?: string;
    contentStyle?: { [key: string]: string };
    isSide: boolean;
    swipeDirection: "down" | "left" | "right";
    useSnapPoints: boolean;
};

const DEFAULT_VIEWPORT_WIDTH_PX = 1280;

export type SideDrawerPointerDragResult = {
    shouldClose: boolean;
    widthPx: number;
};

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
    const rawWidth = input.startWidthPx + delta;
    if (rawWidth < MIN_SIDE_DRAWER_WIDTH_PX - SIDE_DRAWER_CLOSE_SLACK_PX) {
        return {
            shouldClose: true,
            widthPx: MIN_SIDE_DRAWER_WIDTH_PX,
        };
    }
    return {
        shouldClose: false,
        widthPx: clampSideDrawerWidth(rawWidth, input.viewportWidthPx),
    };
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
