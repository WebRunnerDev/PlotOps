import { describe, expect, it } from "vitest";

import { eligibleWatcherAddCandidates } from "./eligible-watcher-add-candidates";

describe("eligibleWatcherAddCandidates", () => {
    it("returns Team Members who are not already Watchers", () => {
        expect(
            eligibleWatcherAddCandidates({
                people: [
                    { id: "a", name: "Ada" },
                    { id: "b", name: "Bea" },
                    { id: "c", name: "Cyd" },
                ],
                watcherUserIds: ["b"],
            })
        ).toEqual([
            { id: "a", name: "Ada" },
            { id: "c", name: "Cyd" },
        ]);
    });

    it("returns empty when every Member already Watches", () => {
        expect(
            eligibleWatcherAddCandidates({
                people: [
                    { id: "a", name: "Ada" },
                    { id: "b", name: "Bea" },
                ],
                watcherUserIds: ["a", "b"],
            })
        ).toEqual([]);
    });
});
