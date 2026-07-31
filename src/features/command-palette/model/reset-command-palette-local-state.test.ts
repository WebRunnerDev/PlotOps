import { describe, expect, it } from "vitest";

import { resetCommandPaletteLocalState } from "./reset-command-palette-local-state";

describe("resetCommandPaletteLocalState", () => {
    it("clears query only (create guard survives close)", () => {
        expect(resetCommandPaletteLocalState()).toEqual({
            query: "",
        });
    });
});
