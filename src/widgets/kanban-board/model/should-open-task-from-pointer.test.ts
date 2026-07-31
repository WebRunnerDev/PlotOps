import { describe, expect, it } from "vitest";

import { shouldOpenTaskFromPointer } from "./should-open-task-from-pointer";

describe("shouldOpenTaskFromPointer", () => {
    it("opens when idle", () => {
        expect(shouldOpenTaskFromPointer(false, false)).toBe(true);
    });

    it("does not open while dragging", () => {
        expect(shouldOpenTaskFromPointer(true, false)).toBe(false);
    });

    it("does not open after a drag until suppress clears", () => {
        expect(shouldOpenTaskFromPointer(false, true)).toBe(false);
    });
});
