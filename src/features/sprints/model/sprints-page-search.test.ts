import { describe, expect, it } from "vitest";

import { parseSprintsPageSearch } from "./sprints-page-search";

describe("parseSprintsPageSearch", () => {
    it("keeps the flow view and the open Task", () => {
        expect(parseSprintsPageSearch({ task: " t1 ", view: "flow" })).toEqual({
            task: "t1",
            view: "flow",
        });
    });

    it("drops unknown views", () => {
        expect(parseSprintsPageSearch({ view: "reports" })).toEqual({});
    });
});
