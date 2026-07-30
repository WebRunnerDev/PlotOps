import { describe, expect, it } from "vitest";

import { resolveColumnDeleteMoveTarget } from "./resolve-column-delete-move-target";

describe("resolveColumnDeleteMoveTarget", () => {
    it("remaps when the column has visible tasks", () => {
        expect(
            resolveColumnDeleteMoveTarget({
                otherColumnId: "todo",
                visibleTaskCount: 2,
            })
        ).toBe("todo");
    });

    it("skips remapping when the column looks empty (archived keep status until restore)", () => {
        expect(
            resolveColumnDeleteMoveTarget({
                otherColumnId: "todo",
                visibleTaskCount: 0,
            })
        ).toBeUndefined();
    });

    it("returns undefined when there is no other column", () => {
        expect(
            resolveColumnDeleteMoveTarget({
                otherColumnId: undefined,
                visibleTaskCount: 2,
            })
        ).toBeUndefined();
    });
});
