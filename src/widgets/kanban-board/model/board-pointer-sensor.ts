import type { PointerEvent as ReactPointerEvent } from "react";

import { PointerSensor, type PointerSensorOptions } from "@dnd-kit/core";

/**
 * PointerSensor that ignores presses on `[data-no-dnd]` (e.g. card checkboxes).
 * Pair with gating `{...listeners}` at the sortable node — synthetic listeners
 * still fire even when a child calls stopPropagation in some cases.
 */
export class BoardPointerSensor extends PointerSensor {
    static activators = [
        {
            eventName: "onPointerDown" as const,
            handler: (
                { nativeEvent: event }: ReactPointerEvent,
                { onActivation }: PointerSensorOptions
            ) => {
                if (
                    !event.isPrimary ||
                    event.button !== 0 ||
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
