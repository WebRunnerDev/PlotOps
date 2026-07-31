import { describe, expect, it } from "vitest";

import { shouldOpenTaskFromKeyboard } from "./should-open-task-from-keyboard";

describe("shouldOpenTaskFromKeyboard", () => {
    it("opens on Enter when not dragging", () => {
        expect(shouldOpenTaskFromKeyboard({ key: "Enter" }, false)).toBe(true);
    });

    it("opens on Space when not dragging", () => {
        expect(shouldOpenTaskFromKeyboard({ key: " " }, false)).toBe(true);
    });

    it("does not open while dragging", () => {
        expect(shouldOpenTaskFromKeyboard({ key: "Enter" }, true)).toBe(false);
    });

    it("ignores other keys", () => {
        expect(shouldOpenTaskFromKeyboard({ key: "Escape" }, false)).toBe(
            false
        );
    });
});
