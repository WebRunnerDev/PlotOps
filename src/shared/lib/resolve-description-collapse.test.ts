import { describe, expect, it } from "vitest";

import {
    DESCRIPTION_COLLAPSE_MAX_HEIGHT_REM,
    resolveDescriptionCollapseView,
} from "./resolve-description-collapse";

describe("resolveDescriptionCollapseView", () => {
    it("exposes a rem-based max height near 260px", () => {
        expect(DESCRIPTION_COLLAPSE_MAX_HEIGHT_REM).toBe(16.25);
    });

    it("does nothing when preference is off", () => {
        expect(
            resolveDescriptionCollapseView({
                dirty: false,
                expanded: false,
                focused: false,
                overflows: true,
                preferenceEnabled: false,
            })
        ).toEqual({
            isClamped: false,
            showCollapseControl: false,
            showExpandControl: false,
        });
    });

    it("clamps without Show more when content fits", () => {
        expect(
            resolveDescriptionCollapseView({
                dirty: false,
                expanded: false,
                focused: false,
                overflows: false,
                preferenceEnabled: true,
            })
        ).toEqual({
            isClamped: true,
            showCollapseControl: false,
            showExpandControl: false,
        });
    });

    it("clamps and offers Show more when collapsed and overflowing", () => {
        expect(
            resolveDescriptionCollapseView({
                dirty: false,
                expanded: false,
                focused: false,
                overflows: true,
                preferenceEnabled: true,
            })
        ).toEqual({
            isClamped: true,
            showCollapseControl: false,
            showExpandControl: true,
        });
    });

    it("offers Show less when expanded, overflowing, clean, and unfocused", () => {
        expect(
            resolveDescriptionCollapseView({
                dirty: false,
                expanded: true,
                focused: false,
                overflows: true,
                preferenceEnabled: true,
            })
        ).toEqual({
            isClamped: false,
            showCollapseControl: true,
            showExpandControl: false,
        });
    });

    it("hides Show less when expanded content fits", () => {
        expect(
            resolveDescriptionCollapseView({
                dirty: false,
                expanded: true,
                focused: false,
                overflows: false,
                preferenceEnabled: true,
            })
        ).toEqual({
            isClamped: false,
            showCollapseControl: false,
            showExpandControl: false,
        });
    });

    it("withholds Show less while dirty", () => {
        expect(
            resolveDescriptionCollapseView({
                dirty: true,
                expanded: true,
                focused: false,
                overflows: true,
                preferenceEnabled: true,
            })
        ).toEqual({
            isClamped: false,
            showCollapseControl: false,
            showExpandControl: false,
        });
    });

    it("withholds Show less while focused", () => {
        expect(
            resolveDescriptionCollapseView({
                dirty: false,
                expanded: true,
                focused: true,
                overflows: true,
                preferenceEnabled: true,
            })
        ).toEqual({
            isClamped: false,
            showCollapseControl: false,
            showExpandControl: false,
        });
    });
});
