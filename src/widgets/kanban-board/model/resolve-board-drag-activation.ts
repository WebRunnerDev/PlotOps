import type { PointerActivationConstraint } from "@dnd-kit/core";

/** Mouse: short distance so desktop drag stays snappy. */
export const BOARD_MOUSE_ACTIVATION: PointerActivationConstraint = {
    distance: 6,
};

/**
 * Touch: long-press so finger pans (board/column scroll) still work;
 * drag starts after the delay if movement stays within tolerance.
 */
export const BOARD_TOUCH_ACTIVATION: PointerActivationConstraint = {
    delay: 250,
    tolerance: 8,
};

export function resolveBoardMouseActivation(): PointerActivationConstraint {
    return BOARD_MOUSE_ACTIVATION;
}

export function resolveBoardTouchActivation(): PointerActivationConstraint {
    return BOARD_TOUCH_ACTIVATION;
}
