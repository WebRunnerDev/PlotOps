import { describe, expect, it } from "vitest";

import { resolveTaskSwapAnimation } from "./resolve-task-swap-animation";

describe("resolveTaskSwapAnimation", () => {
    it("does not animate the first open", () => {
        expect(
            resolveTaskSwapAnimation({
                currentId: "parent",
                currentParentId: undefined,
                previousId: undefined,
                previousParentId: undefined,
            })
        ).toEqual({ direction: "forward", shouldAnimate: false });
    });

    it("slides forward from Parent Task to Subtask", () => {
        expect(
            resolveTaskSwapAnimation({
                currentId: "child",
                currentParentId: "parent",
                previousId: "parent",
                previousParentId: undefined,
            })
        ).toEqual({ direction: "forward", shouldAnimate: true });
    });

    it("slides back from Subtask to Parent Task", () => {
        expect(
            resolveTaskSwapAnimation({
                currentId: "parent",
                currentParentId: undefined,
                previousId: "child",
                previousParentId: "parent",
            })
        ).toEqual({ direction: "back", shouldAnimate: true });
    });

    it("does not animate when the same Task is re-selected", () => {
        expect(
            resolveTaskSwapAnimation({
                currentId: "parent",
                currentParentId: undefined,
                previousId: "parent",
                previousParentId: undefined,
            })
        ).toEqual({ direction: "forward", shouldAnimate: false });
    });
});
