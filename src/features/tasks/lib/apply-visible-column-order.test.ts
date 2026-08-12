import { describe, expect, it } from "vitest";

import type { Task } from "@/features/tasks/model/types";

import {
    applyVisibleColumnOrder,
    reorderVisibleColumnSubset,
} from "./apply-visible-column-order";

function task(id: string): Task {
    return {
        boardId: "board",
        createdAt: "2026-01-01T00:00:00.000Z",
        id,
        key: id,
        status: "todo",
        title: id,
        type: "task",
    };
}

describe("applyVisibleColumnOrder", () => {
    it("reorders visible cards while hidden siblings keep their slots", () => {
        const column = [task("a"), task("b"), task("c"), task("d"), task("e")];

        const next = applyVisibleColumnOrder(column, ["a", "e", "c"]);

        expect(next.map((item) => item.id)).toEqual(["a", "b", "e", "d", "c"]);
    });

    it("appends newly inserted visible tasks after existing slots", () => {
        const existing = [task("a"), task("b"), task("c")];
        const incoming = task("new");
        const column = [...existing, incoming];

        const next = applyVisibleColumnOrder(column, ["a", "new", "c"]);

        expect(next.map((item) => item.id)).toEqual(["a", "b", "new", "c"]);
    });
});

describe("reorderVisibleColumnSubset", () => {
    it("moves active over visible neighbor without jumping hidden tasks", () => {
        const column = [
            task("a"),
            task("hidden"),
            task("c"),
            task("hidden-2"),
            task("e"),
        ];

        const next = reorderVisibleColumnSubset(
            column,
            ["a", "c", "e"],
            "e",
            "c"
        );

        expect(next?.map((item) => item.id)).toEqual([
            "a",
            "hidden",
            "e",
            "hidden-2",
            "c",
        ]);
    });
});
