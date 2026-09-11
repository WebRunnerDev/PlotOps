import { describe, expect, it } from "vitest";

import {
    resolveActiveSprintFilterIds,
    toggleActiveSprintFilterId,
} from "./resolve-active-sprint-filter";

describe("resolveActiveSprintFilterIds", () => {
    it("defaults to all Actives when selection is unset", () => {
        expect(
            resolveActiveSprintFilterIds({
                activeSprintIds: ["a", "b"],
                selectedIds: null,
            })
        ).toEqual(["a", "b"]);
    });

    it("keeps an explicit subset that still exists", () => {
        expect(
            resolveActiveSprintFilterIds({
                activeSprintIds: ["a", "b", "c"],
                selectedIds: ["b", "c"],
            })
        ).toEqual(["b", "c"]);
    });

    it("falls back to all Actives when the selection is entirely stale", () => {
        expect(
            resolveActiveSprintFilterIds({
                activeSprintIds: ["a", "b"],
                selectedIds: ["gone"],
            })
        ).toEqual(["a", "b"]);
    });
});

describe("toggleActiveSprintFilterId", () => {
    it("adds an unselected Active", () => {
        expect(
            toggleActiveSprintFilterId({
                selectedIds: ["a"],
                toggleId: "b",
            })
        ).toEqual(["a", "b"]);
    });

    it("removes a selected Active when others remain", () => {
        expect(
            toggleActiveSprintFilterId({
                selectedIds: ["a", "b"],
                toggleId: "a",
            })
        ).toEqual(["b"]);
    });

    it("refuses to clear the last selected Active", () => {
        expect(
            toggleActiveSprintFilterId({
                selectedIds: ["a"],
                toggleId: "a",
            })
        ).toEqual(["a"]);
    });
});
