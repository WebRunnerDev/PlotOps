import type {
    MouseEvent as ReactMouseEvent,
    TouchEvent as ReactTouchEvent,
} from "react";

import {
    MouseSensor,
    type MouseSensorOptions,
    TouchSensor,
    type TouchSensorOptions,
} from "@dnd-kit/core";

/**
 * Drag sensors that ignore presses on `[data-no-dnd]` (e.g. card checkboxes).
 * Pair with gated `{...listeners}` at the sortable node — synthetic listeners
 * still fire even when a child calls stopPropagation in some cases.
 *
 * Mouse uses short distance activation; touch uses long-press so board/column
 * scroll still works (see resolve-board-drag-activation).
 */
export class BoardMouseSensor extends MouseSensor {
    static activators = [
        {
            eventName: "onMouseDown" as const,
            handler: (
                { nativeEvent: event }: ReactMouseEvent,
                { onActivation }: MouseSensorOptions
            ) => {
                if (event.button === 2 || isNoDndEventTarget(event.target)) {
                    return false;
                }

                onActivation?.({ event });
                return true;
            },
        },
    ];
}

export class BoardTouchSensor extends TouchSensor {
    static activators = [
        {
            eventName: "onTouchStart" as const,
            handler: (
                { nativeEvent: event }: ReactTouchEvent,
                { onActivation }: TouchSensorOptions
            ) => {
                if (
                    event.touches.length > 1 ||
                    isNoDndEventTarget(event.target)
                ) {
                    return false;
                }

                onActivation?.({ event });
                return true;
            },
        },
    ];
}

export function isNoDndEventTarget(target: EventTarget | null): boolean {
    if (!target || typeof (target as Element).closest !== "function") {
        return false;
    }
    return Boolean((target as Element).closest("[data-no-dnd]"));
}
