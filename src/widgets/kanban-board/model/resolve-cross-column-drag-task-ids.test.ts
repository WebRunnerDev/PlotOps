import { describe, expect, it } from "vitest";

import { resolveCrossColumnDragTaskIds } from "./resolve-cross-column-drag-task-ids";

describe("resolveCrossColumnDragTaskIds", () => {
    it("returns only the active id when it is not selected", () => {
        expect(
            resolveCrossColumnDragTaskIds({
                activeId: "a",
                selectedIds: new Set(["b", "c"]),
            })
        ).toEqual(["a"]);
    });

    it("returns only the active id when it is the sole selection", () => {
        expect(
            resolveCrossColumnDragTaskIds({
                activeId: "a",
                selectedIds: new Set(["a"]),
            })
        ).toEqual(["a"]);
    });

    it("returns the full selection when dragging a selected card in a multi-select", () => {
        expect(
            resolveCrossColumnDragTaskIds({
                activeId: "b",
                selectedIds: new Set(["a", "b", "c"]),
            }).toSorted()
        ).toEqual(["a", "b", "c"]);
    });
});
