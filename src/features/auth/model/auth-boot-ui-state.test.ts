import { describe, expect, it } from "vitest";

/**
 * AppRouter gate: spinner while loading; boot error only when settled failed;
 * never mount the shell while a remounted boot is in flight after a prior error.
 */
function resolveAuthBootUi(input: {
    bootError: boolean;
    isLoading: boolean;
}): "app" | "boot-error" | "spinner" {
    if (input.isLoading) return "spinner";
    if (input.bootError) return "boot-error";
    return "app";
}

describe("auth boot UI gate", () => {
    it("stays on spinner when a remount clears bootError but re-enters loading", () => {
        // Regression: effect remount used to setBootError(false) without
        // setIsLoading(true), so AppRouter jumped error → app shell briefly.
        expect(resolveAuthBootUi({ bootError: false, isLoading: true })).toBe(
            "spinner"
        );
    });

    it("does not show the app shell for a settled boot error", () => {
        expect(resolveAuthBootUi({ bootError: true, isLoading: false })).toBe(
            "boot-error"
        );
    });

    it("shows the app only when boot succeeded", () => {
        expect(resolveAuthBootUi({ bootError: false, isLoading: false })).toBe(
            "app"
        );
    });
});
