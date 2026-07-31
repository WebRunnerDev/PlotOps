import { afterEach, describe, expect, it, vi } from "vitest";

import {
    safeGetItem,
    safeRemoveItem,
    safeSetItem,
} from "@/shared/lib/safe-storage";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("safe storage helpers", () => {
    it("reads and writes when storage is available", () => {
        const store = new Map<string, string>();
        vi.stubGlobal("sessionStorage", {
            getItem: (key: string) => store.get(key) ?? null,
            removeItem: (key: string) => {
                store.delete(key);
            },
            setItem: (key: string, value: string) => {
                store.set(key, value);
            },
        });

        safeSetItem("sessionStorage", "k", "v");
        expect(safeGetItem("sessionStorage", "k")).toBe("v");
        safeRemoveItem("sessionStorage", "k");
        expect(safeGetItem("sessionStorage", "k")).toBeNull();
    });

    it("returns null / no-ops when getItem throws", () => {
        vi.stubGlobal("localStorage", {
            getItem: () => {
                throw new Error("blocked");
            },
            removeItem: () => {
                throw new Error("blocked");
            },
            setItem: () => {
                throw new Error("blocked");
            },
        });

        expect(safeGetItem("localStorage", "k")).toBeNull();
        expect(() => safeSetItem("localStorage", "k", "v")).not.toThrow();
        expect(() => safeRemoveItem("localStorage", "k")).not.toThrow();
    });

    it("returns null when storage is missing", () => {
        // Falsy stub — unicorn strips bare `undefined` from stubGlobal.
        vi.stubGlobal("sessionStorage", false as never);
        expect(safeGetItem("sessionStorage", "k")).toBeNull();
        expect(() => safeSetItem("sessionStorage", "k", "v")).not.toThrow();
    });
});
