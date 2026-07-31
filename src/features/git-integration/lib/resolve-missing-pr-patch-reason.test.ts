import { describe, expect, it } from "vitest";

import { resolveMissingPrPatchReason } from "./resolve-missing-pr-patch-reason";

describe("resolveMissingPrPatchReason", () => {
    it("treats known binary extensions as binary", () => {
        expect(resolveMissingPrPatchReason("assets/logo.png")).toBe("binary");
        expect(resolveMissingPrPatchReason("font.WOFF2")).toBe("binary");
    });

    it("treats missing patch on text-like paths as too large", () => {
        expect(resolveMissingPrPatchReason("src/app.tsx")).toBe("too-large");
        expect(resolveMissingPrPatchReason("Makefile")).toBe("too-large");
    });
});
