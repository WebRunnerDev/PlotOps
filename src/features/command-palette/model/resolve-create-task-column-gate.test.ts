import { describe, expect, it } from "vitest";

import { resolveCreateTaskColumnGate } from "./resolve-create-task-column-gate";

describe("resolveCreateTaskColumnGate", () => {
    it("returns loading while columns are not ready", () => {
        expect(resolveCreateTaskColumnGate(false)).toBe("loading");
        expect(resolveCreateTaskColumnGate(false, "todo")).toBe("loading");
    });

    it("returns empty when ready but no first column", () => {
        expect(resolveCreateTaskColumnGate(true)).toBe("empty");
    });

    it("returns ready when first column exists", () => {
        expect(resolveCreateTaskColumnGate(true, "todo")).toBe("ready");
    });
});
