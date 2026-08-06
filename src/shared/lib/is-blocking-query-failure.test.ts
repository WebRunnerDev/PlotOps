import { describe, expect, it } from "vitest";

import { isBlockingQueryFailure } from "@/shared/lib/is-blocking-query-failure";

describe("isBlockingQueryFailure", () => {
    it("blocks only when the query failed with no cached data", () => {
        expect(
            isBlockingQueryFailure({
                data: undefined,
                error: new Error("JWT expired"),
            })
        ).toBe(true);
    });

    it("does not tear down UI on refetch failure while cache remains", () => {
        expect(
            isBlockingQueryFailure({
                data: { id: "proj-1" },
                error: new Error("JWT expired"),
            })
        ).toBe(false);

        expect(
            isBlockingQueryFailure({
                data: [],
                error: new Error("network"),
            })
        ).toBe(false);
    });

    it("does not block when there is no error", () => {
        expect(
            isBlockingQueryFailure({
                data: undefined,
                error: null,
            })
        ).toBe(false);
    });
});
