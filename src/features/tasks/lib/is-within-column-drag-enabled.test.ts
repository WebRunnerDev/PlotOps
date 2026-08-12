import { describe, expect, it } from "vitest";

import { isWithinColumnDragEnabled } from "./is-within-column-drag-enabled";

describe("isWithinColumnDragEnabled", () => {
    it("enables within-column drag when Board sort is Manual", () => {
        expect(isWithinColumnDragEnabled({ field: "manual" })).toBe(true);
    });

    it("disables within-column drag when Priority Board sort is active", () => {
        expect(
            isWithinColumnDragEnabled({
                direction: "desc",
                field: "priority",
            })
        ).toBe(false);
        expect(
            isWithinColumnDragEnabled({
                direction: "asc",
                field: "priority",
            })
        ).toBe(false);
    });

    it("disables within-column drag when Deadline, Created, or Title Board sort is active", () => {
        expect(
            isWithinColumnDragEnabled({
                direction: "asc",
                field: "deadline",
            })
        ).toBe(false);
        expect(
            isWithinColumnDragEnabled({
                direction: "desc",
                field: "created",
            })
        ).toBe(false);
        expect(
            isWithinColumnDragEnabled({
                direction: "desc",
                field: "title",
            })
        ).toBe(false);
    });
});
