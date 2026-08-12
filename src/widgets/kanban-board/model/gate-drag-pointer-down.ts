import type { DraggableSyntheticListeners } from "@dnd-kit/core";
import type {
    MouseEvent as ReactMouseEvent,
    PointerEvent as ReactPointerEvent,
    TouchEvent as ReactTouchEvent,
} from "react";

import { isNoDndEventTarget } from "@/widgets/kanban-board/model/board-pointer-sensor";

type DragActivatorEvent = ReactMouseEvent<HTMLElement> &
    ReactPointerEvent<HTMLElement> &
    ReactTouchEvent<HTMLElement>;

const ACTIVATOR_KEYS = [
    "onPointerDown",
    "onMouseDown",
    "onTouchStart",
] as const;

/**
 * Gate every dnd-kit activator listener so `[data-no-dnd]` never arms drag,
 * regardless of whether Mouse or Touch sensors are registered.
 * Do not call preventDefault — that blocks Base UI checkbox click/toggle.
 */
export function gateDragListeners(
    listeners: DraggableSyntheticListeners | undefined
): DraggableSyntheticListeners | undefined {
    if (!listeners) return undefined;

    const gated: DraggableSyntheticListeners = { ...listeners };

    for (const key of ACTIVATOR_KEYS) {
        const original = listeners[key];
        if (typeof original !== "function") continue;
        gated[key] = (event: DragActivatorEvent) => {
            if (isNoDndEventTarget(event.target)) {
                return;
            }
            original(event);
        };
    }

    return gated;
}
