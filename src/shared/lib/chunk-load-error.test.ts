import { describe, expect, it, vi } from "vitest";

import {
    CHUNK_RELOAD_COOLDOWN_MS,
    createNewDeployReloader,
    isChunkLoadError,
} from "./chunk-load-error";

describe("isChunkLoadError", () => {
    it("matches the lazy-import failures of each browser engine", () => {
        expect(
            isChunkLoadError(
                new TypeError(
                    "Failed to fetch dynamically imported module: https://x/assets/a.js"
                )
            )
        ).toBe(true);
        expect(
            isChunkLoadError(
                new TypeError("error loading dynamically imported module: a.js")
            )
        ).toBe(true);
        expect(
            isChunkLoadError(new TypeError("Importing a module script failed."))
        ).toBe(true);
        expect(
            isChunkLoadError(
                new Error("Unable to preload CSS for /assets/a.css")
            )
        ).toBe(true);
    });

    it("ignores unrelated errors", () => {
        expect(isChunkLoadError(new Error("boom"))).toBe(false);
        expect(
            isChunkLoadError("Failed to fetch dynamically imported module")
        ).toBe(false);
        // eslint-disable-next-line unicorn/no-null -- non-Error thrown value
        expect(isChunkLoadError(null)).toBe(false);
    });
});

function setup(lastReloadAt: null | string, now = 100_000) {
    let stored = lastReloadAt;
    const reload = vi.fn();
    const reloader = createNewDeployReloader({
        now: () => now,
        readLastReloadAt: () => stored,
        reload,
        writeLastReloadAt: (value) => {
            stored = value;
        },
    });
    return { reload, reloader, stored: () => stored };
}

describe("createNewDeployReloader", () => {
    it("reloads when no reload happened before", () => {
        const { reload, reloader, stored } = setup(null);

        expect(reloader.canReload()).toBe(true);
        expect(reloader.reload()).toBe(true);
        expect(reload).toHaveBeenCalledOnce();
        expect(stored()).toBe("100000");
    });

    it("refuses to loop when the last reload was within the cooldown", () => {
        const { reload, reloader } = setup(
            String(100_000 - CHUNK_RELOAD_COOLDOWN_MS + 1)
        );

        expect(reloader.canReload()).toBe(false);
        expect(reloader.reload()).toBe(false);
        expect(reload).not.toHaveBeenCalled();
    });

    it("reloads again once the cooldown has passed", () => {
        const { reload, reloader } = setup(
            String(100_000 - CHUNK_RELOAD_COOLDOWN_MS)
        );

        expect(reloader.reload()).toBe(true);
        expect(reload).toHaveBeenCalledOnce();
    });

    it("is idempotent within one page lifetime (StrictMode double effects)", () => {
        const { reload, reloader } = setup(null);

        expect(reloader.reload()).toBe(true);
        expect(reloader.reload()).toBe(true);
        expect(reloader.canReload()).toBe(true);
        expect(reload).toHaveBeenCalledOnce();
    });

    it("treats unreadable storage values as no previous reload", () => {
        const { reload, reloader } = setup("garbage");

        expect(reloader.reload()).toBe(true);
        expect(reload).toHaveBeenCalledOnce();
    });
});
