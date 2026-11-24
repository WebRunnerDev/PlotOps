import { describe, expect, it } from "vitest";

import { formatSprintDateRange } from "./format-sprint-dates";

describe("formatSprintDateRange", () => {
    it("omits the year inside the current year", () => {
        expect(
            formatSprintDateRange({
                endsOn: "2026-08-15",
                locale: "en-US",
                startsOn: "2026-08-02",
                today: "2026-11-24",
            })
        ).toBe("Aug 2 – Aug 15");
    });

    it("shows the year when the window crosses years", () => {
        expect(
            formatSprintDateRange({
                endsOn: "2027-01-09",
                locale: "en-US",
                startsOn: "2026-12-29",
                today: "2026-12-30",
            })
        ).toBe("Dec 29, 2026 – Jan 9, 2027");
    });

    it("returns null when a date is missing", () => {
        expect(
            formatSprintDateRange({
                endsOn: undefined,
                startsOn: "2026-08-02",
                today: "2026-11-24",
            })
        ).toBeNull();
    });
});
