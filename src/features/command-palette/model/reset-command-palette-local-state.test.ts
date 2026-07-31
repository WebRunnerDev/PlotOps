import { describe, expect, it } from "vitest";

import { resetCommandPaletteLocalState } from "./reset-command-palette-local-state";

describe("resetCommandPaletteLocalState", () => {
    it("clears query and creating flag", () => {
        expect(resetCommandPaletteLocalState()).toEqual({
            isCreating: false,
            query: "",
        });
    });
});
