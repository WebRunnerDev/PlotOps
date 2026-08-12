import { describe, expect, it } from "vitest";

import { isNoDndEventTarget } from "./board-pointer-sensor";

function elementWithClosest(found: boolean): Element {
    return {
        closest: (selector: string) =>
            found && selector === "[data-no-dnd]" ? ({} as Element) : null,
    } as Element;
}

describe("isNoDndEventTarget", () => {
    it("returns true when closest finds [data-no-dnd]", () => {
        expect(isNoDndEventTarget(elementWithClosest(true))).toBe(true);
    });

    it("returns false when closest finds nothing", () => {
        expect(isNoDndEventTarget(elementWithClosest(false))).toBe(false);
    });

    it("returns false for non-Element targets", () => {
        expect(isNoDndEventTarget(null)).toBe(false);
        expect(isNoDndEventTarget("text" as unknown as EventTarget)).toBe(
            false
        );
    });
});
