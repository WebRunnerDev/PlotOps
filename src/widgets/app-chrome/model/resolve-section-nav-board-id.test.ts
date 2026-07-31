import { describe, expect, it } from "vitest";

import { resolveSectionNavBoardId } from "./resolve-section-nav-board-id";

describe("resolveSectionNavBoardId", () => {
    it("returns undefined while boards are pending when no candidate exists", () => {
        expect(
            resolveSectionNavBoardId({
                boards: [],
                status: "pending",
            })
        ).toBeUndefined();
    });

    it("keeps route board id while boards are pending", () => {
        expect(
            resolveSectionNavBoardId({
                boardIdFromRoute: "board-1",
                boards: [],
                status: "pending",
            })
        ).toBe("board-1");
    });

    it("keeps remembered board id while boards errored", () => {
        expect(
            resolveSectionNavBoardId({
                boards: [],
                rememberedBoardId: "board-2",
                status: "error",
            })
        ).toBeUndefined();
    });

    it("omits board links on boards error even with a route candidate", () => {
        expect(
            resolveSectionNavBoardId({
                boardIdFromRoute: "board-1",
                boards: [],
                status: "error",
            })
        ).toBeUndefined();
    });

    it("does not keep an orphan remembered id after empty success", () => {
        expect(
            resolveSectionNavBoardId({
                boards: [],
                rememberedBoardId: "deleted-board",
                status: "success",
            })
        ).toBeUndefined();
    });

    it("falls back to the first board when remembered id is missing from the list", () => {
        expect(
            resolveSectionNavBoardId({
                boards: [{ id: "board-a" }, { id: "board-b" }],
                rememberedBoardId: "gone",
                status: "success",
            })
        ).toBe("board-a");
    });

    it("prefers a remembered id that is still in the list", () => {
        expect(
            resolveSectionNavBoardId({
                boards: [{ id: "board-a" }, { id: "board-b" }],
                rememberedBoardId: "board-b",
                status: "success",
            })
        ).toBe("board-b");
    });
});
