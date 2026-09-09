import { describe, expect, it } from "vitest";

import { isAuthEntryPath, shouldCoverAuthEntry } from "./auth-entry-cover";

describe("auth entry cover gate", () => {
    it("covers while boot UI is up", () => {
        expect(
            shouldCoverAuthEntry({
                authEntryResolved: true,
                hasUser: false,
                showBoot: true,
            })
        ).toBe(true);
    });

    it("covers signed-in users until the entry redirect resolves", () => {
        // Regression: AnimatePresence mode=wait unmounted BootScreen before
        // RouterProvider finished redirecting `/` → `/home`, painting LoginForm.
        expect(
            shouldCoverAuthEntry({
                authEntryResolved: false,
                hasUser: true,
                showBoot: false,
            })
        ).toBe(true);
    });

    it("reveals sign-in only when logged out and boot is done", () => {
        expect(
            shouldCoverAuthEntry({
                authEntryResolved: true,
                hasUser: false,
                showBoot: false,
            })
        ).toBe(false);
    });

    it("lifts cover once the signed-in user left auth entry routes", () => {
        expect(
            shouldCoverAuthEntry({
                authEntryResolved: true,
                hasUser: true,
                showBoot: false,
            })
        ).toBe(false);
        expect(isAuthEntryPath("/")).toBe(true);
        expect(isAuthEntryPath("/home")).toBe(false);
    });
});
