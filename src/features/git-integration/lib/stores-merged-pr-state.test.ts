import { describe, expect, it } from "vitest";

import { storesMergedPrState } from "@/features/git-integration/lib/stores-merged-pr-state";

describe("storesMergedPrState", () => {
    it("stores a merge into the Board's Base branch", () => {
        expect(storesMergedPrState({ baseRef: "dev", boardBase: "dev" })).toBe(
            true
        );
    });

    it("keeps a merge into another branch pending (webhook wrong_base)", () => {
        expect(
            storesMergedPrState({ baseRef: "release", boardBase: "dev" })
        ).toBe(false);
    });

    it("stores the merge when there is no Base branch or base is unknown", () => {
        expect(
            storesMergedPrState({ baseRef: "release", boardBase: null })
        ).toBe(true);
        expect(
            storesMergedPrState({ baseRef: undefined, boardBase: "dev" })
        ).toBe(true);
    });
});
