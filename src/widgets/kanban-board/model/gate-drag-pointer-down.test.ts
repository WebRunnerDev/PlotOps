import { describe, expect, it, vi } from "vitest";

import { gateDragPointerDown } from "./gate-drag-pointer-down";

function elementWithClosest(found: boolean): Element {
    return {
        closest: (selector: string) =>
            found && selector === "[data-no-dnd]" ? ({} as Element) : null,
    } as Element;
}

describe("gateDragPointerDown", () => {
    it("does not call the activator when the press is on [data-no-dnd]", () => {
        const original = vi.fn();
        const gated = gateDragPointerDown({ onPointerDown: original });

        gated?.({
            target: elementWithClosest(true),
        } as unknown as React.PointerEvent<HTMLElement>);

        expect(original).not.toHaveBeenCalled();
    });

    it("forwards the activator when the press is outside [data-no-dnd]", () => {
        const original = vi.fn();
        const gated = gateDragPointerDown({ onPointerDown: original });
        const event = {
            target: elementWithClosest(false),
        } as unknown as React.PointerEvent<HTMLElement>;

        gated?.(event);

        expect(original).toHaveBeenCalledWith(event);
    });
});
