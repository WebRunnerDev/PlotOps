import type { DraggableSyntheticListeners } from "@dnd-kit/core";
import type { PointerEvent as ReactPointerEvent } from "react";

import { isNoDndEventTarget } from "@/widgets/kanban-board/model/board-pointer-sensor";

/**
 * Skip dnd-kit activator when the press started on `[data-no-dnd]`.
 * Do not call preventDefault — that blocks Base UI checkbox click/toggle.
 */
export function gateDragPointerDown(
    listeners: DraggableSyntheticListeners | undefined
): ((event: ReactPointerEvent<HTMLElement>) => void) | undefined {
    const original = listeners?.onPointerDown;
    if (!original) return undefined;

    return (event: ReactPointerEvent<HTMLElement>) => {
        if (isNoDndEventTarget(event.target)) {
            return;
        }
        original(event);
    };
}
