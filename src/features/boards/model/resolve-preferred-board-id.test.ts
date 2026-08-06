import { describe, expect, it } from "vitest";

import { resolvePreferredBoardId } from "./resolve-preferred-board-id";

describe("resolvePreferredBoardId", () => {
    const boards = [{ id: "board-a" }, { id: "board-b" }];

    it("returns undefined when there are no boards", () => {
        expect(resolvePreferredBoardId([], "board-a")).toBeUndefined();
        expect(resolvePreferredBoardId([])).toBeUndefined();
    });

    it("returns the remembered board when it is still in the list", () => {
        expect(resolvePreferredBoardId(boards, "board-b")).toBe("board-b");
    });

    it("falls back to the first board when remembered id is missing", () => {
        expect(resolvePreferredBoardId(boards, "gone")).toBe("board-a");
        expect(resolvePreferredBoardId(boards, null)).toBe("board-a");
        expect(resolvePreferredBoardId(boards)).toBe("board-a");
    });
});
