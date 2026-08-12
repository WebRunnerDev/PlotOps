import { describe, expect, it, vi } from "vitest";

import { gateDragListeners } from "./gate-drag-pointer-down";

function elementWithClosest(found: boolean): Element {
    return {
        closest: (selector: string) =>
            found && selector === "[data-no-dnd]" ? ({} as Element) : null,
    } as Element;
}

describe("gateDragListeners", () => {
    it("does not call the activator when the press is on [data-no-dnd]", () => {
        const onMouseDown = vi.fn();
        const gated = gateDragListeners({ onMouseDown });

        gated?.onMouseDown?.({
            target: elementWithClosest(true),
        } as never);

        expect(onMouseDown).not.toHaveBeenCalled();
    });

    it("forwards the activator when the press is outside [data-no-dnd]", () => {
        const onTouchStart = vi.fn();
        const gated = gateDragListeners({ onTouchStart });
        const event = {
            target: elementWithClosest(false),
        } as never;

        gated?.onTouchStart?.(event);

        expect(onTouchStart).toHaveBeenCalledWith(event);
    });

    it("gates mouse and touch activators independently", () => {
        const onMouseDown = vi.fn();
        const onTouchStart = vi.fn();
        const gated = gateDragListeners({ onMouseDown, onTouchStart });

        gated?.onMouseDown?.({
            target: elementWithClosest(true),
        } as never);
        gated?.onTouchStart?.({
            target: elementWithClosest(false),
        } as never);

        expect(onMouseDown).not.toHaveBeenCalled();
        expect(onTouchStart).toHaveBeenCalled();
    });
});
