import { describe, expect, it } from "vitest";

import { resolveMemberFieldChange } from "./task-member-field";

describe("resolveMemberFieldChange", () => {
    it("returns undefined when the selected person id is unchanged", () => {
        expect(
            resolveMemberFieldChange({
                currentId: "guest-1",
                next: { id: "guest-1", name: "Demo Guest" },
            })
        ).toBeUndefined();
    });

    it("returns undefined when clearing an already-empty selection", () => {
        expect(
            resolveMemberFieldChange({
                currentId: null,
                next: { id: "__none__", name: "Unassigned" },
            })
        ).toBeUndefined();
        expect(
            resolveMemberFieldChange({
                currentId: null,
                next: null,
            })
        ).toBeUndefined();
    });

    it("returns null when clearing a selected person", () => {
        expect(
            resolveMemberFieldChange({
                currentId: "guest-1",
                next: { id: "__none__", name: "Unassigned" },
            })
        ).toBeNull();
    });

    it("returns the next person when the id changes", () => {
        const next = { id: "guest-1", name: "Demo Guest" };
        expect(
            resolveMemberFieldChange({
                currentId: null,
                next,
            })
        ).toBe(next);
    });
});
