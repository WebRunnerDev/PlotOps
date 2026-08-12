import { describe, expect, it } from "vitest";

import {
    BOARD_MOUSE_ACTIVATION,
    BOARD_TOUCH_ACTIVATION,
    resolveBoardMouseActivation,
    resolveBoardTouchActivation,
} from "./resolve-board-drag-activation";

describe("resolveBoardDragActivation", () => {
    it("uses a short distance constraint for mouse drag", () => {
        expect(resolveBoardMouseActivation()).toEqual({ distance: 6 });
        expect(resolveBoardMouseActivation()).toBe(BOARD_MOUSE_ACTIVATION);
    });

    it("uses long-press delay and tolerance for touch drag", () => {
        expect(resolveBoardTouchActivation()).toEqual({
            delay: 250,
            tolerance: 8,
        });
        expect(resolveBoardTouchActivation()).toBe(BOARD_TOUCH_ACTIVATION);
    });
});
