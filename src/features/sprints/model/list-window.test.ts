import { describe, expect, it } from "vitest";

import {
    BACKLOG_LIST_PAGE_SIZE,
    initialListWindowCount,
    nextVisibleCount,
    shouldOfferSelectAllMatching,
    windowListItems,
} from "@/features/sprints/model/list-window";

describe("list window seam", () => {
    it("returns the first visibleCount items and remaining", () => {
        const items = ["a", "b", "c", "d", "e"];

        expect(windowListItems(items, 3)).toEqual({
            hasMore: true,
            remaining: 2,
            visible: ["a", "b", "c"],
        });
    });

    it("treats visibleCount at or above length as fully shown", () => {
        const items = ["a", "b"];

        expect(windowListItems(items, 2)).toEqual({
            hasMore: false,
            remaining: 0,
            visible: ["a", "b"],
        });
        expect(windowListItems(items, 10)).toEqual({
            hasMore: false,
            remaining: 0,
            visible: ["a", "b"],
        });
    });

    it("clamps a non-positive visibleCount to an empty window", () => {
        expect(windowListItems(["a", "b"], 0)).toEqual({
            hasMore: true,
            remaining: 2,
            visible: [],
        });
        expect(windowListItems(["a"], -5)).toEqual({
            hasMore: true,
            remaining: 1,
            visible: [],
        });
    });
});

describe("next visible count seam", () => {
    it("adds pageSize on more, capped at total", () => {
        expect(
            nextVisibleCount({
                current: 30,
                mode: "more",
                pageSize: BACKLOG_LIST_PAGE_SIZE,
                total: 100,
            })
        ).toBe(60);
        expect(
            nextVisibleCount({
                current: 90,
                mode: "more",
                pageSize: BACKLOG_LIST_PAGE_SIZE,
                total: 100,
            })
        ).toBe(100);
    });

    it("jumps to total on all", () => {
        expect(
            nextVisibleCount({
                current: 30,
                mode: "all",
                pageSize: BACKLOG_LIST_PAGE_SIZE,
                total: 87,
            })
        ).toBe(87);
    });

    it("never returns below current when already past total", () => {
        expect(
            nextVisibleCount({
                current: 50,
                mode: "more",
                pageSize: 30,
                total: 40,
            })
        ).toBe(40);
    });
});

describe("initial list window count seam", () => {
    it("defaults to the backlog page size", () => {
        expect(initialListWindowCount()).toBe(BACKLOG_LIST_PAGE_SIZE);
        expect(initialListWindowCount(50)).toBe(50);
    });
});

describe("select-all-matching offer seam", () => {
    it("offers when every visible row is selected and more remain", () => {
        expect(
            shouldOfferSelectAllMatching({
                selectedVisibleCount: 30,
                totalCount: 80,
                visibleCount: 30,
            })
        ).toBe(true);
    });

    it("does not offer when the window already shows everything", () => {
        expect(
            shouldOfferSelectAllMatching({
                selectedVisibleCount: 12,
                totalCount: 12,
                visibleCount: 12,
            })
        ).toBe(false);
    });

    it("does not offer when only some visible rows are selected", () => {
        expect(
            shouldOfferSelectAllMatching({
                selectedVisibleCount: 10,
                totalCount: 80,
                visibleCount: 30,
            })
        ).toBe(false);
    });

    it("does not offer for an empty section", () => {
        expect(
            shouldOfferSelectAllMatching({
                selectedVisibleCount: 0,
                totalCount: 0,
                visibleCount: 0,
            })
        ).toBe(false);
    });
});
