import { describe, expect, it } from "vitest";

import {
    intersectionObserverRoot,
    isDocumentScrollRoot,
    isScrollableOverflow,
    offsetToBringSectionToTop,
    scrollPortMetrics,
} from "./scroll-sprint-section";

describe("offsetToBringSectionToTop", () => {
    it("scrolls the section just below the sticky jump nav", () => {
        expect(
            offsetToBringSectionToTop({
                rootTop: 0,
                scrollTop: 80,
                sectionTop: 400,
                stickyOffset: 48,
            })
        ).toBe(432);
    });

    it("does not scroll above the start of the root", () => {
        expect(
            offsetToBringSectionToTop({
                rootTop: 0,
                scrollTop: 0,
                sectionTop: 10,
                stickyOffset: 48,
            })
        ).toBe(0);
    });
});

describe("isScrollableOverflow", () => {
    it("accepts an overflow auto box that actually scrolls", () => {
        expect(isScrollableOverflow("auto", 1200, 400)).toBe(true);
    });

    it("rejects overflow auto that is not clipped", () => {
        expect(isScrollableOverflow("auto", 400, 400)).toBe(false);
    });
});

describe("document scroll root", () => {
    it("uses the viewport when there is no inner scroller", () => {
        expect(intersectionObserverRoot(null)).toBeNull();
        expect(isDocumentScrollRoot(null)).toBe(false);
    });

    it("keeps an inner scroller as the IO root", () => {
        const scroller = { id: "board-scroller" } as HTMLElement;
        expect(isDocumentScrollRoot(scroller)).toBe(false);
        expect(intersectionObserverRoot(scroller)).toBe(scroller);
    });

    it("measures an inner scroller from its box", () => {
        const scroller = {
            getBoundingClientRect: () => ({ top: 48 }),
            scrollTop: 120,
        } as HTMLElement;
        expect(scrollPortMetrics(scroller)).toEqual({
            rootTop: 48,
            scrollTop: 120,
        });
    });
});
